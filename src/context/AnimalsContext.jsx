import PropTypes from "prop-types"
import { Client } from "@petfinder/petfinder-js"
import { createContext, useContext, useState } from "react"

const AnimalsContext = createContext()

function AnimalsProvider({ children }) {
  const [animals, setAnimals] = useState([])
  const [animal, setAnimal] = useState([])
  const [isLoading, setIsLoading] = useState(false)

  const client = new Client({
    apiKey: import.meta.env.VITE_PETFINDER_API_KEY,
    secret: import.meta.env.VITE_PETFINDER_SECRET,
  })

  async function getLocalAnimals(lat, lng, options) {
    try {
      setIsLoading(true)
      const {
        data: { animals },
      } = await client.animal.search({
        limit: 100,
        location: `${lat},${lng}`,
        ...options,
      })
      setAnimals(animals)
    } catch (err) {
      console.error(err)
      alert("There was an error fetching animal data.")
    } finally {
      setIsLoading(false)
    }
  }

  async function getAnimals(options) {
    try {
      setIsLoading(true)
      const {
        data: { animals },
      } = await client.animal.search({
        ...options,
      })
      setAnimals(animals)
    } catch (err) {
      console.error(err)
      alert("There was an error fetching animal data.")
    } finally {
      setIsLoading(false)
    }
  }

  async function getAnimal(id) {
    try {
      setIsLoading(true)
      const {
        data: { animal },
      } = await client.animal.show(id)
      setAnimal(animal)
    } catch (err) {
      console.error(err)
      alert("There was an error fetching animal data.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AnimalsContext.Provider
      value={{
        animals,
        animal,
        isLoading,
        getAnimal,
        getAnimals,
        getLocalAnimals,
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

AnimalsProvider.propTypes = {
  children: PropTypes.node,
}
