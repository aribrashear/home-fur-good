import PropTypes from "prop-types"
import { Client } from "@petfinder/petfinder-js"
import { createContext, useContext, useReducer, useRef } from "react"

const AnimalsContext = createContext()

const initialState = {
  currAnimal: {},
  animals: [],
  isLoading: false,
  status: "",
  error: "",
}

const ACTIONS = {
  LOADING: "loading",
  ANIMAL_LOADED: "animal/loaded",
  ANIMALS_LOADED: "animals/loaded",
  UPDATE_STATUS: "status/update",
  REJECTED: "rejected",
}

const FETCH_REPEAT_MESSAGES = [
  "Cleaning out dust...",
  "Tightening loose screws...",
  "Polishing surfaces...",
  "Turning it off and on again...",
]

function reducer(state, action) {
  switch (action.type) {
    case ACTIONS.LOADING:
      return {
        ...state,
        isLoading: true,
        status: action?.payload || "Loading...",
      }

    case ACTIONS.ANIMAL_LOADED:
      return {
        ...state,
        isLoading: false,
        currAnimal: action.payload,
        status: "Success!",
      }

    case ACTIONS.ANIMALS_LOADED:
      return {
        ...state,
        isLoading: false,
        animals: action.payload,
        status: "Success!",
      }

    case ACTIONS.REJECTED:
      return {
        ...state,
        isLoading: false,
        error: action.payload,
        status: "Error.",
      }
    case ACTIONS.UPDATE_STATUS:
      return {
        ...state,
        status: action.payload,
      }
    default:
      throw new Error("Unknown action type.")
  }
}

function AnimalsProvider({ children }) {
  const cache = useRef({})
  const [{ currAnimal, animals, isLoading, error, status }, dispatch] =
    useReducer(reducer, initialState)

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
  // More: https://www.petfinder.com/developers/v2/docs/#get-animals
  async function getAnimals(options = {}) {
    try {
      dispatch({ type: ACTIONS.LOADING, payload: "Finding Animals..." })

      const {
        data: { animals },
      } = await client.animal.search({
        ...options,
      })

      // STEP 01: FORMAT ANIMAL DATA FOR GEOCODING
      dispatch({
        type: ACTIONS.UPDATE_STATUS,
        payload: "Processing animal data...",
      })
      // Returns formatted addresses, but also condenses the animals with matching locations to reduce unnecessary fetch calls.
      const batchFormatAnimalArr = generateUniqueAddressArr(animals)
      // Pulling only the relevant addresses to make the batch call.
      const addressOnlyArr = batchFormatAnimalArr.map(({ address }) => address)
      // STEP 02: GET LAT/LNG INFORMATION TO DISPLAY ON MAP
      dispatch({
        type: ACTIONS.UPDATE_STATUS,
        payload: "Getting address data...",
      })

      // Check to see if the location exists in storage, and remove it from the batch request if so.
      let existingAddresses = []
      let newAddresses = []
      for (let i = 0; i < addressOnlyArr.length; i++) {
        const curr = addressOnlyArr[i]
        const storedAddress = localStorage.getItem(curr)
        if (storedAddress) {
          const parsed = JSON.parse(storedAddress)
          existingAddresses.push(parsed)
        } else {
          newAddresses.push(curr)
        }
      }

      // If there are new addresses that need to be requested, proceed with the batch function. Otherwise, we can go straight to the marker creation.
      if (newAddresses.length > 0) {
        // Getting all lat/lng information as a batch request.
        const updatedAddressArr = await getBatchCoordinates(
          newAddresses,
          10 * 1000,
          9 // Will run for roughly 1 1/2 minutes before maxing out.
        )

        if (!updatedAddressArr)
          dispatch({
            type: ACTIONS.REJECTED,
            payload: "Failed to get location data.",
          })

        const newFormattedAddresses = updatedAddressArr.map((address) => ({
          id: address.place_id,
          query: address.query.text,
          lat: address.lat,
          lng: address.lon,
          state: address.state,
          county: address.county,
          city: address.city,
          postcode: address.postcode,
          attribution: address.datasource,
        }))

        // Adding all new addresses to the existing address array.
        existingAddresses.push(...newFormattedAddresses)

        // Caching the address data to localStorage to reduce bulk on API calls, since we expect it to remain the same over time.
        for (let i = 0; i < newFormattedAddresses.length; i++) {
          const curr = newFormattedAddresses[i]
          const title = curr.query
          const data = JSON.stringify(curr)
          localStorage.setItem(title, data)
        }
      }

      // STEP 03: Format data for use in displaying on the map.
      dispatch({
        type: ACTIONS.UPDATE_STATUS,
        payload: "Finalizing results...",
      })
      const finalAnimalArr = createAnimalMarkers(
        existingAddresses,
        batchFormatAnimalArr
      )

      dispatch({ type: ACTIONS.ANIMALS_LOADED, payload: finalAnimalArr })
    } catch (err) {
      console.error(err)
      dispatch({
        type: ACTIONS.REJECTED,
        payload: "There was an error fetching animal data.",
      })
    }
  }

  async function getAnimal(id) {
    const cacheID = `animal:${id}`
    try {
      dispatch({ type: ACTIONS.LOADING })
      if (existsInCache(cacheID)) {
        dispatch({
          type: ACTIONS.ANIMAL_LOADED,
          payload: cache.current[cacheID],
        })
      } else {
        const {
          data: { animal },
        } = await client.animal.show(id)
        dispatch({ type: ACTIONS.ANIMAL_LOADED, payload: animal })
        updateCache(cacheID, animal)
      }
    } catch (err) {
      console.error(err)
      dispatch({
        type: ACTIONS.REJECTED,
        payload: "There was an error fetching animal data.",
      })
    }
  }

  // Gets geolocation information (specifically, lat/lng which is needed to display markers on the map) as a batch request from an array of address strings.
  async function getBatchCoordinates(
    arr,
    timeout = 10 * 1000 /*timeout between attempts*/,
    maxAttempts = 50
  ) {
    // This function expects an array of string addresses.
    const baseURL = "https://api.geoapify.com/v1/batch/geocode/search?"
    const params = {
      lang: "en",
      apiKey: import.meta.env.VITE_GEOCODING_API_KEY,
    }
    const query = new URLSearchParams(params).toString()

    // Get the base URL for the batch request.
    const res = await fetch(`${baseURL}${query}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(arr),
    })

    if (res.ok) {
      const { url } = await res.json()

      const queryResult = await getAsyncResult(url, timeout, maxAttempts)

      return queryResult
    }

    function getAsyncResult(url, timeout, maxAttempts) {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          repeatUntilSuccess(url, resolve, reject, 0)
        }, timeout)
      })

      async function repeatUntilSuccess(url, resolve, reject, attempt) {
        try {
          const res = await fetch(url)
          if (res.status === 200) {
            const data = await res.json()
            resolve(data)
          } else if (attempt >= maxAttempts) {
            reject("Maximum amounts of attempts reached.")
          } else if (res.status === 202) {
            setTimeout(() => {
              dispatch({
                type: ACTIONS.UPDATE_STATUS,
                payload:
                  FETCH_REPEAT_MESSAGES[
                    attempt < FETCH_REPEAT_MESSAGES.length
                      ? attempt
                      : attempt % FETCH_REPEAT_MESSAGES.length
                  ],
              })
              repeatUntilSuccess(url, resolve, reject, attempt + 1)
            }, timeout)
          } else {
            reject("Unknown error occurred.")
          }
        } catch (err) {
          reject(err)
        }
      }
    }
  }

  return (
    <AnimalsContext.Provider
      value={{
        isLoading,
        error,
        status,
        currAnimal,
        getAnimal,
        animals,
        getAnimals,
      }}
    >
      {children}
    </AnimalsContext.Provider>
  )
}

function useAnimals() {
  const context = useContext(AnimalsContext)
  if (context === undefined) {
    throw new Error("AnimalsContext was used outside of the AnimalsProvider.")
  }
  return context
}

export { AnimalsProvider, useAnimals }

// -------------------------------
// ---------- PROP-TYPES
// -------------------------------
AnimalsProvider.propTypes = {
  children: PropTypes.node,
}

// -------------------------------
// ---------- ADDITIONAL FUNCTIONS
// -------------------------------

// Formats the animal data by grouping them into singular array elements which contain a location and all the animals which share that location.
function generateUniqueAddressArr(animalData) {
  function formatPetAddressToStr(addressObj) {
    const { address1: address, city, state, postcode, country } = addressObj

    const formattedAddress = `${
      address ? address + ", " : ""
    }${city}, ${state} ${postcode}, ${country}`

    return formattedAddress
  }

  // Will contain one element per unique address, stored in an object with the associated animals at that address.
  // FORMAT: {address: "", animals: [{animalObj}]}
  let addresses = []

  for (let i = 0; i < animalData.length; i++) {
    const currAnimal = animalData[i]
    const { address } = currAnimal.contact
    const formattedAddress = formatPetAddressToStr(address)
    const existingAddress = addresses?.find(
      ({ address }) => address === formattedAddress
    )

    // Add the animal to the corresponding object if it exists.
    if (existingAddress !== undefined) {
      const arrIndex = addresses.indexOf(existingAddress)
      addresses[arrIndex].animals.push(currAnimal)

      // Otherwise, create a new object with a new address.
    } else if (existingAddress === undefined) {
      addresses.push({ address: formattedAddress, animals: [currAnimal] })
    }
  }

  return addresses
}

// Accepts the geolocation and batched animal information in order to match up locations/animals with their respective lat/lng. Additionally, this will group any animals which may have had loose locations (EX. city, zipcode) that ended up with the same lat/lng to avoid duplicate pins on the map.
function createAnimalMarkers(locations = [], batchedAnimArr = []) {
  let markers = []

  for (let i = 0; i < batchedAnimArr.length; i++) {
    const { address, animals } = batchedAnimArr[i]

    // Gathering all animal related data.
    const animalOverviews = animals.map((animal) => ({
      id: animal.id,
      species: animal.species,
      type: animal.type,
      name: animal.name,
      age: animal.age,
      gender: animal.gender,
      photos: animal.primary_photo_cropped,
      distance: animal.distance,
      orgID: animal.organization_id,
      externalUrl: animal.url,
    }))
    const totalNum = animals.length

    // Gathering all location related data.
    // Match the original address query to the returned coordinates.
    const relevantCoordinates = locations?.find((obj) => obj.query === address)
    const { lat, lng } = relevantCoordinates
    const id = `Marker${relevantCoordinates.id || animals[0].id}`

    // If no coordinates were provided, we cannot display them on the map.
    if (!lat || !lng) continue

    // Check if coordinates already exist.
    const existingCoordinates = markers.find(
      ({ coordinates }) => coordinates[0] === lat && coordinates[1] === lng
    )

    // If coordinates exist, instead of making a new instance, add the animals to the existing coordinates.
    if (existingCoordinates) {
      const index = markers.indexOf(existingCoordinates)
      const totalAddedAnimals = animals.length
      markers[index].animals.push(...animalOverviews)
      markers[index].totalNum += totalAddedAnimals

      continue
    }

    markers.push({
      id,
      coordinates: [lat, lng],
      totalNum,
      animals: animalOverviews,
    })
  }
  return markers
}
