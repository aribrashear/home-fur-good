import PropTypes from "prop-types"
import { Icon } from "leaflet"
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet"
import MarkerClusterGroup from "react-leaflet-cluster"

function Map({ style = { height: "30rem", width: "30rem" }, markers = [] }) {
  const initialCoordinates = [32.715759, -117.163818]

  const customIcon = new Icon({
    iconUrl: "/location.png",
    iconSize: [38, 38], // size in px
  })

  return (
    <div style={{ ...style }}>
      <MapContainer center={initialCoordinates} zoom={13}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MarkerClusterGroup chunkedLoading>
          {markers.map(({ geocode, descText }) => (
            <Marker
              key={`${geocode}${descText}`}
              position={geocode}
              icon={customIcon}
            >
              <Popup>{descText}</Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  )
}

export default Map

Map.propTypes = {
  style: PropTypes.object,
  markers: PropTypes.arrayOf(
    PropTypes.shape({
      geocode: PropTypes.arrayOf(PropTypes.number),
      descText: PropTypes.string,
    })
  ),
}
