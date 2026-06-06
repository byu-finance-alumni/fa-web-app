declare module "@svg-maps/usa" {
  interface SvgMapLocation {
    id: string;
    name: string;
    path: string;
  }
  interface SvgMap {
    label: string;
    viewBox: string;
    locations: SvgMapLocation[];
  }
  const usa: SvgMap;
  export default usa;
}
