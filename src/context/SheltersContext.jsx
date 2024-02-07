import PropTypes from "prop-types"
import { Client } from "@petfinder/petfinder-js"
import { createContext, useContext, useState } from "react"

const SheltersContext = createContext()

function SheltersProvider({ children }) {
  const [shelters, setShelters] = useState([])
  const [shelter, setShelter] = useState({})
  const [isLoading, setIsLoading] = useState(false)

  const client = new Client({
    apiKey: import.meta.env.VITE_PETFINDER_API_KEY,
    secret: import.meta.env.VITE_PETFINDER_SECRET,
  })

  async function getLocalShelters(lat, lng, options) {
    try {
      const {
        data: { organizations },
      } = await client.organization.search({
        location: `${lat},${lng}`,
        ...options,
      })
      setShelters(organizations)
    } catch (err) {
      console.error(err)
      alert("There was an error fetching shelter data.")
    } finally {
      setIsLoading(false)
    }
  }

  async function getShelters(options) {
    try {
      const {
        data: { organizations },
      } = await client.organization.search({
        ...options,
      })
      setShelters(organizations)
    } catch (err) {
      console.error(err)
      alert("There was an error fetching shelter data.")
    } finally {
      setIsLoading(false)
    }
  }

  async function getShelter(id) {
    try {
      setIsLoading(true)
      const {
        data: { organization },
      } = await client.organization.show(id)
      setShelter(organization)
    } catch (err) {
      console.error(err)
      alert("There was an error fetching shelter data.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <SheltersContext.Provider
      value={{
        shelters,
        shelter,
        isLoading,
        getShelter,
        getShelters,
        getLocalShelters,
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
