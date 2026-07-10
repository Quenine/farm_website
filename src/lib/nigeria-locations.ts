export type NigeriaLocation = {
  state: string;
  cities: string[];
};

export const nigeriaLocations: NigeriaLocation[] = [
  { state: "Abia", cities: ["All", "Umuahia", "Aba", "Ohafia"] },
  { state: "Adamawa", cities: ["All", "Yola", "Mubi", "Numan"] },
  { state: "Akwa Ibom", cities: ["All", "Uyo", "Eket", "Ikot Ekpene"] },
  { state: "Anambra", cities: ["All", "Awka", "Onitsha", "Nnewi", "Ekwulobia"] },
  { state: "Bauchi", cities: ["All", "Bauchi", "Azare"] },
  { state: "Bayelsa", cities: ["All", "Yenagoa"] },
  { state: "Benue", cities: ["All", "Makurdi", "Gboko", "Otukpo"] },
  { state: "Borno", cities: ["All", "Maiduguri", "Biu"] },
  { state: "Cross River", cities: ["All", "Calabar", "Ikom", "Ogoja"] },
  { state: "Delta", cities: ["All", "Asaba", "Warri", "Ughelli", "Sapele"] },
  { state: "Ebonyi", cities: ["All", "Abakaliki", "Afikpo"] },
  { state: "Edo", cities: ["All", "Benin City", "Auchi", "Ekpoma"] },
  { state: "Ekiti", cities: ["All", "Ado-Ekiti", "Ikere-Ekiti"] },
  { state: "Enugu", cities: ["All", "Enugu", "Nsukka"] },
  { state: "FCT", cities: ["All", "Abuja", "Gwagwalada", "Kubwa", "Lugbe", "Nyanya", "Wuse", "Maitama"] },
  { state: "Gombe", cities: ["All", "Gombe", "Billiri"] },
  { state: "Imo", cities: ["All", "Owerri", "Orlu", "Okigwe"] },
  { state: "Jigawa", cities: ["All", "Dutse", "Hadejia"] },
  { state: "Kaduna", cities: ["All", "Kaduna", "Zaria", "Kafanchan"] },
  { state: "Kano", cities: ["All", "Kano", "Wudil"] },
  { state: "Katsina", cities: ["All", "Katsina", "Daura"] },
  { state: "Kebbi", cities: ["All", "Birnin Kebbi", "Argungu", "Yauri"] },
  { state: "Kogi", cities: ["All", "Lokoja", "Okene", "Kabba", "Anyigba"] },
  { state: "Kwara", cities: ["All", "Ilorin", "Offa"] },
  { state: "Lagos", cities: ["All", "Lagos Mainland", "Lagos Island", "Ikeja", "Lekki", "Ajah", "Epe", "Ikorodu", "Badagry", "Surulere", "Yaba", "Victoria Island"] },
  { state: "Nasarawa", cities: ["All", "Lafia", "Keffi", "Akwanga"] },
  { state: "Niger", cities: ["All", "Minna", "Bida", "Suleja", "Kontagora"] },
  { state: "Ogun", cities: ["All", "Abeokuta", "Ijebu-Ode", "Sagamu", "Ota"] },
  { state: "Ondo", cities: ["All", "Akure", "Ondo", "Owo"] },
  { state: "Osun", cities: ["All", "Osogbo", "Ile-Ife", "Ilesa", "Ede"] },
  { state: "Oyo", cities: ["All", "Ibadan", "Ogbomoso", "Oyo", "Iseyin", "Saki"] },
  { state: "Plateau", cities: ["All", "Jos", "Bukuru", "Pankshin"] },
  { state: "Rivers", cities: ["All", "Port Harcourt", "Obio-Akpor", "Bonny"] },
  { state: "Sokoto", cities: ["All", "Sokoto"] },
  { state: "Taraba", cities: ["All", "Jalingo", "Wukari"] },
  { state: "Yobe", cities: ["All", "Damaturu", "Potiskum", "Nguru"] },
  { state: "Zamfara", cities: ["All", "Gusau", "Kaura Namoda"] },
];

export const nigeriaStateNames = nigeriaLocations.map((location) => location.state);

export function getNigeriaCities(state: string) {
  return nigeriaLocations.find((location) => location.state === state)?.cities ?? ["All"];
}

export function mergeUniqueSorted(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}