import PropTypes from "prop-types"
import { Client } from "@petfinder/petfinder-js"
import { createContext, useContext, useReducer, useRef } from "react"

const SheltersContext = createContext()

const initialState = {
  currShelter: {},
  shelters: [],
  isLoading: false,
  error: "",
}

const ACTIONS = {
  LOADING: "loading",
  SHELTER_LOADED: "shelter/loaded",
  SHELTERS_LOADED: "shelters/loaded",
  REJECTED: "rejected",
}

function reducer(state, action) {
  switch (action.type) {
    case ACTIONS.LOADING:
      return { ...state, isLoading: true }

    case ACTIONS.SHELTER_LOADED:
      return {
        ...state,
        isLoading: false,
        currShelter: action.payload,
      }

    case ACTIONS.SHELTERS_LOADED:
      return {
        ...state,
        isLoading: false,
        shelters: action.payload,
      }

    case ACTIONS.REJECTED:
      return {
        ...state,
        isLoading: false,
        error: action.payload,
      }
    default:
      throw new Error("Unknown action type.")
  }
}

function SheltersProvider({ children }) {
  const [{ currShelter, shelters, isLoading, error }, dispatch] = useReducer(
    reducer,
    initialState
  )
  const cache = useRef({})

  const client = new Client({
    apiKey: import.meta.env.VITE_PETFINDER_API_KEY,
    secret: import.meta.env.VITE_PETFINDER_SECRET,
  })

  function existsInCache(key) {
    if (cache.current[key]) return true
    return false
  }

  function updateCache(key, value) {
    cache.current[key] = value
  }

  // Relevant options for this fetch request:
  // For specific user location:
  // location: `${lat},${lng}` || `${city}` || `${postalCode}`
  // If location is set, you can specify distance to you:
  // distance: int (default: 100, max: 500)
  // Max results to return:
  // limit: int (default: 20, max: 100)
  // More: https://www.petfinder.com/developers/v2/docs/#get-organizations
  async function getShelters(options = {}) {
    const cacheID = `shelters:${options?.stringify() || "no-params"}`

    try {
      dispatch({ type: ACTIONS.LOADING })
      if (existsInCache(cacheID)) {
        dispatch({
          type: ACTIONS.SHELTERS_LOADED,
          payload: cache.current[cacheID],
        })
      } else {
        const {
          data: { organizations },
        } = await client.organization.search({
          ...options,
        })
        dispatch({ type: ACTIONS.SHELTERS_LOADED, payload: organizations })
        updateCache(cacheID, organizations)
      }
    } catch (err) {
      console.error(err)
      dispatch({
        type: ACTIONS.REJECTED,
        payload: "There was an error fetching shelter data.",
      })
    }
  }

  async function getShelter(id) {
    const cacheID = `shelter:${id}`
    try {
      dispatch({ type: ACTIONS.LOADING })
      if (existsInCache(cacheID)) {
        dispatch({
          type: ACTIONS.SHELTER_LOADED,
          payload: cache.current[cacheID],
        })
      } else {
        const {
          data: { organization },
        } = await client.organization.show(id)
        dispatch({ type: ACTIONS.SHELTER_LOADED, payload: organization })
        updateCache(cacheID, organization)
      }
    } catch (err) {
      console.error(err)
      dispatch({
        type: ACTIONS.REJECTED,
        payload: "There was an error fetching shelter data.",
      })
    }
  }

  return (
    <SheltersContext.Provider
      value={{
        isLoading,
        error,
        currShelter,
        getShelter,
        shelters,
        getShelters,
      }}
    >
      {children}
    </SheltersContext.Provider>
  )
}

function useShelters() {
  const context = useContext(SheltersContext)
  if (context === undefined) {
    throw new Error("SheltersContext was used outside of the SheltersProvider.")
  }
  return context
}

export { SheltersProvider, useShelters }

SheltersProvider.propTypes = {
  children: PropTypes.node,
}
