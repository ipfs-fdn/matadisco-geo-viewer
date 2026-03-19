import { Client, simpleFetchHandler } from "@atcute/client"

const COLLECTION = "cx.vmx.matadisco"
// Discovery endpoint (relay) vs record-fetching endpoint (PDS) are different services
const RELAY_URL = "https://bsky.network"

function createClient(serviceUrl) {
  return new Client({ handler: simpleFetchHandler({ service: serviceUrl }) })
}

// Discover DIDs that have matadisco records via the relay (bsky.network)
export async function discoverRepos() {
  const client = createClient(RELAY_URL)
  const { data } = await client.get("com.atproto.sync.listReposByCollection", {
    params: { collection: COLLECTION },
  })
  return data.repos?.map((r) => r.did) ?? []
}

// Fetch a page of records from a PDS for a given DID
export async function fetchRecords(pdsUrl, did, cursor = undefined) {
  const client = createClient(pdsUrl)
  const params = { repo: did, collection: COLLECTION, limit: 100 }
  if (cursor) params.cursor = cursor

  const { data } = await client.get("com.atproto.repo.listRecords", {
    params,
  })

  // Attach the DID to each record so the UI can show which repo it came from
  const records = data.records.map((r) => ({ did, ...r.value }))
  return { records, cursor: data.cursor ?? null }
}
