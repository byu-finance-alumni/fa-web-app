// Type the world-atlas topojson asset as a plain TopoJSON `Topology` instead of
// letting `resolveJsonModule` deep-infer the (huge) literal shape — the world
// map casts it through `topojson-client`'s `feature()` anyway.
declare module "world-atlas/countries-110m.json" {
  import type { Topology } from "topojson-specification";
  const topology: Topology;
  export default topology;
}
