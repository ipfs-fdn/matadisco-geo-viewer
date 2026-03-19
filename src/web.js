import { PAST_ITEMS_OFFSET } from "./config.js"
import {
  startStream,
  consumeStream,
  GEO_METADATA_PREFIXES,
} from "./jetstream.js"
import { discoverRepos, fetchRecords } from "./pds.js"

export const MAX_ITEMS = 250
const recordsElement = document.querySelector(".records")
const statusDot = document.getElementById("status-dot")
const statusText = document.getElementById("status-text")
const statusMessage = document.getElementById("status-message")
const recordCount = document.getElementById("record-count")
const modeSelect = document.getElementById("mode-select")
const geoToggle = document.getElementById("geo-toggle")
const pdsControls = document.getElementById("pds-controls")
const pdsUrlInput = document.getElementById("pds-url")
const pdsDidInput = document.getElementById("pds-did")
const pdsFetchBtn = document.getElementById("pds-fetch")
const pdsLoadMoreBtn = document.getElementById("pds-load-more")

let recordsReceived = 0
let map = null
let geoJsonLayer = null
let mapEnabled = true
let geoOnly = false
let currentMode = "pds"
// Track the stream iterator so we can stop it when switching modes
let streamIterator = null
// Track PDS pagination cursor
let pdsPageCursor = null
let pdsCurrentDid = null

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

geoToggle.addEventListener("change", () => {
  geoOnly = geoToggle.checked
})

// Check if a record passes the geo-metadata prefix filter
function isGeoRecord(record) {
  return (
    record.metadata &&
    GEO_METADATA_PREFIXES.some((prefix) => record.metadata.startsWith(prefix))
  )
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
      if (props.datetime)
        fields.push(["Date", new Date(props.datetime).toLocaleString()])
      if (props["eo:cloud_cover"] !== undefined)
        fields.push(["Cloud cover", `${Math.round(props["eo:cloud_cover"])}%`])
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

// Render a single record card into the grid
function renderRecord(record) {
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

  // Show when the record was created
  if (record.created) {
    const dl = recordElement.querySelector(".metadata-content")
    const div = document.createElement("div")
    const dt = document.createElement("span")
    dt.className = "font-medium"
    dt.textContent = "Created: "
    const dd = document.createElement("span")
    dd.textContent = new Date(record.created).toLocaleString()
    div.append(dt, dd)
    dl.append(div)
  }

  // Show DID if present (PDS mode attaches it to each record)
  if (record.did) {
    const dl = recordElement.querySelector(".metadata-content")
    const div = document.createElement("div")
    const dt = document.createElement("span")
    dt.className = "font-medium"
    dt.textContent = "Repo: "
    const dd = document.createElement("span")
    dd.textContent = record.did
    div.append(dt, dd)
    dl.append(div)
  }

  // Prepend first so the DOM element exists when the fetch resolves
  recordsElement.prepend(recordElement)
  // Only fetch and render STAC metadata for geo records
  if (isGeoRecord(record)) {
    fetchAndPlotMetadata(record.metadata, recordsElement.firstElementChild)
  }

  if (recordsElement.children.length > MAX_ITEMS) {
    recordsElement.lastElementChild.remove()
  }
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

function clearRecords() {
  recordsElement.innerHTML = ""
  recordsReceived = 0
  recordCount.textContent = "0 records"
  if (geoJsonLayer) geoJsonLayer.clearLayers()
}

function updateRecordCount() {
  recordCount.textContent = `${recordsReceived} ${recordsReceived === 1 ? "record" : "records"}`
}

// --- Live Stream mode ---

async function startLiveStream() {
  // Start two minutes in the past. Timestamp has to be in microseconds.
  const startTime = (Date.now() - PAST_ITEMS_OFFSET) * 1000
  updateStatus("connecting")
  const subscription = startStream(startTime)
  updateStatus("connected", "Fetching recent records...")
  const stream = consumeStream(subscription)
  // Store the iterator so we can stop it when switching modes
  streamIterator = stream[Symbol.asyncIterator]()

  try {
    while (true) {
      const { value: record, done } = await streamIterator.next()
      if (done || currentMode !== "stream") break

      // Apply geo filter if enabled
      if (geoOnly && !isGeoRecord(record)) continue

      console.log(JSON.stringify(record))

      if (recordsReceived === 0) {
        updateStatus(
          "waiting",
          "Waiting for new records (may take a few minutes depending on time of day)",
        )
      }

      recordsReceived++
      updateRecordCount()
      renderRecord(record)
    }
  } finally {
    // Clean up: closing the iterator triggers the subscription's WebSocket destroy
    streamIterator?.return()
    streamIterator = null
  }
}

// --- PDS Read mode ---

async function loadPdsPage(pdsUrl, did) {
  updateStatus("connecting", "Fetching records...")
  try {
    const result = await fetchRecords(pdsUrl, did, pdsPageCursor)
    for (const record of result.records) {
      if (geoOnly && !isGeoRecord(record)) continue
      recordsReceived++
      updateRecordCount()
      renderRecord(record)
    }
    pdsPageCursor = result.cursor
    pdsLoadMoreBtn.classList.toggle("hidden", !pdsPageCursor)
    updateStatus("connected", `Loaded ${recordsReceived} records from ${did}`)
  } catch (err) {
    updateStatus("waiting", `Fetch error: ${err.message}`)
  }
}

async function handlePdsFetch() {
  const pdsUrl = pdsUrlInput.value.trim()
  let did = pdsDidInput.value.trim()

  clearRecords()
  pdsPageCursor = null

  // If no DID provided, discover repos on this PDS
  if (!did) {
    updateStatus("connecting", "Discovering repos...")
    try {
      const dids = await discoverRepos()
      if (dids.length === 0) {
        updateStatus("waiting", "No repos found with matadisco records")
        return
      }
      did = dids[0]
      pdsDidInput.value = did
      updateStatus(
        "connected",
        `Found ${dids.length} repo(s). Loading ${did}...`,
      )
    } catch (err) {
      updateStatus("waiting", `Discovery error: ${err.message}`)
      return
    }
  }

  pdsCurrentDid = did
  await loadPdsPage(pdsUrl, did)
}

// --- Mode switching ---

async function stopStream() {
  if (streamIterator) {
    await streamIterator.return()
    streamIterator = null
  }
}

modeSelect.addEventListener("change", async () => {
  const newMode = modeSelect.value
  if (newMode === currentMode) return
  currentMode = newMode
  clearRecords()

  if (currentMode === "pds") {
    pdsControls.classList.remove("hidden")
    await stopStream()
    updateStatus("connected", "PDS mode — enter a PDS URL and click Fetch")
  } else {
    pdsControls.classList.add("hidden")
    pdsLoadMoreBtn.classList.add("hidden")
    startLiveStream()
  }
})

pdsFetchBtn.addEventListener("click", handlePdsFetch)
pdsLoadMoreBtn.addEventListener("click", () => {
  if (pdsCurrentDid) {
    loadPdsPage(pdsUrlInput.value.trim(), pdsCurrentDid)
  }
})

// Start in PDS mode by default — show controls and prompt user to fetch
pdsControls.classList.remove("hidden")
updateStatus("connected", "PDS mode — enter a PDS URL and click Fetch")
