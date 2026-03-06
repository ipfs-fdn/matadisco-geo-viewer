import { PAST_ITEMS_OFFSET } from "./config.js"
import { startStream, consumeStream } from "./jetstream.js"

export const MAX_ITEMS = 250
const recordsElement = document.querySelector(".records")
const statusDot = document.getElementById("status-dot")
const statusText = document.getElementById("status-text")
const statusMessage = document.getElementById("status-message")
const recordCount = document.getElementById("record-count")

let recordsReceived = 0
let map = null
let geoJsonLayer = null
let mapEnabled = true

const mapToggle = document.getElementById("map-toggle")
const mapContainer = document.getElementById("map-container")

function initMap() {
  if (map) return
  map = L.map("map").setView([0, 0], 2)
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map)
  geoJsonLayer = L.geoJSON(null, {
    style: { color: "#2563eb", weight: 2, fillOpacity: 0.15 },
  }).addTo(map)
}

mapToggle.addEventListener("change", () => {
  mapEnabled = mapToggle.checked
  if (mapEnabled) {
    mapContainer.classList.remove("hidden")
    initMap()
    // Leaflet needs a size recalc after becoming visible
    setTimeout(() => map.invalidateSize(), 0)
  } else {
    mapContainer.classList.add("hidden")
  }
})

// Initialize map on load if enabled by default
if (mapEnabled) {
  initMap()
}

function fetchAndPlotMetadata(url, cardElement) {
  fetch(url)
    .then((res) => res.json())
    .then((data) => {
      // Plot geometry on map
      if (mapEnabled && data.geometry?.coordinates) {
        geoJsonLayer.addData(data.geometry)
        map.fitBounds(geoJsonLayer.getBounds(), { padding: [20, 20] })
      }

      // Display key fields inline in the card
      const dl = cardElement.querySelector(".metadata-content")
      const props = data.properties ?? {}
      const fields = []
      if (props.datetime) fields.push(["Date", new Date(props.datetime).toLocaleString()])
      if (props["eo:cloud_cover"] !== undefined) fields.push(["Cloud cover", `${Math.round(props["eo:cloud_cover"])}%`])
      if (data.collection) fields.push(["Collection", data.collection])

      fields.forEach(([key, value]) => {
        const div = document.createElement("div")
        const dt = document.createElement("span")
        dt.className = "font-medium"
        dt.textContent = `${key}: `
        const dd = document.createElement("span")
        dd.textContent = value
        div.append(dt, dd)
        dl.append(div)
      })
    })
    .catch(() => {})
}

// Update status indicator
function updateStatus(status, message = "") {
  switch (status) {
    case "connecting":
      statusDot.className = "w-2 h-2 rounded-full bg-yellow-400 pulse-dot"
      statusText.textContent = "Connecting..."
      statusText.className = "text-sm font-medium text-yellow-600"
      break
    case "connected":
      statusDot.className = "w-2 h-2 rounded-full bg-green-500 pulse-dot"
      statusText.textContent = "Connected"
      statusText.className = "text-sm font-medium text-green-600"
      break
    case "waiting":
      statusDot.className = "w-2 h-2 rounded-full bg-blue-500 pulse-dot"
      statusText.textContent = "Listening"
      statusText.className = "text-sm font-medium text-blue-600"
      break
  }
  statusMessage.textContent = message
}

// Start two minutes in the past. Timestamp has to be in microseconds.
const startTime = (Date.now() - PAST_ITEMS_OFFSET) * 1000

updateStatus("connecting")
const subscription = startStream(startTime)
updateStatus("connected", "Fetching recent records...")
const stream = consumeStream(subscription)

for await (const record of stream) {
  console.log(JSON.stringify(record))

  // Update status to listening after first record
  if (recordsReceived === 0) {
    updateStatus(
      "waiting",
      "Waiting for new records (may take a few minutes depending on time of day)",
    )
  }

  recordsReceived++
  recordCount.textContent = `${recordsReceived} ${recordsReceived === 1 ? "record" : "records"}`

  const recordElement = document
    .getElementById("record-template")
    .content.cloneNode(true)

  const previewElement = recordElement.querySelector("div.preview")

  // Each record contains a link to the metadata
  recordElement.querySelector("a").href = record.metadata
  recordElement.querySelector("a").textContent = record.metadata

  // If the there is a preview and it's an image, show it.
  if (
    record.preview !== undefined &&
    record.preview.mimeType.startsWith("image/")
  ) {
    const imageElement = document
      .getElementById("record-template-preview-image")
      .content.querySelector("img")
      .cloneNode(true)
    imageElement.src = record.preview.url
    previewElement.prepend(imageElement)
  }

  // Prepend first so the DOM element exists when the fetch resolves
  recordsElement.prepend(recordElement)
  fetchAndPlotMetadata(record.metadata, recordsElement.firstElementChild)

  if (recordsElement.children.length > MAX_ITEMS) {
    recordsElement.lastElementChild.remove()
  }
}
