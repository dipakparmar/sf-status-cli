const BASE = "https://api.status.salesforce.com/v1";

async function request(path, params = {}) {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

export const api = {
  // Instances
  instancesStatusPreview: (params) =>
    request("/instances/status/preview", params),
  instanceStatus: (key) => request(`/instances/${key}/status`),
  instances: (params) => request("/instances", params),

  // Incidents
  activeIncidents: () => request("/incidents/active"),
  incidents: (params) => request("/incidents", params),
  incident: (id) => request(`/incidents/${id}`),

  // Maintenances
  maintenances: (params) => request("/maintenances", params),
  maintenance: (id) => request(`/maintenances/${id}`),
  maintenancesPreview: (params) => request("/maintenances/preview", params),

  // General messages
  generalMessages: () => request("/generalMessages"),

  // Products / services
  products: () => request("/products"),
  services: () => request("/services"),
};
