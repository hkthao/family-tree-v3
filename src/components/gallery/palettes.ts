import type { GalleryPalette } from "./GalleryScene";

/** Các "tông phòng" (preset) dùng chung cho tạo phòng + xem phòng. */
export type GalleryPreset = { id: string; name: string; pal: GalleryPalette };

export const GALLERY_PRESETS: GalleryPreset[] = [
  {
    id: "white",
    name: "Bảo tàng trắng",
    pal: { bg: "#E8E8EA", bgTop: "#FBFBFC", bgBottom: "#D9DADE", floor: "#C6C6C9", wall: "#EAEAEE", ceiling: "#F7F7F8", frame: "#FCFCFC", placeholder: "#DBDBDE" },
  },
  {
    id: "warm",
    name: "Ấm (kem)",
    pal: { bg: "#E7DED0", bgTop: "#F5EEE0", bgBottom: "#DACFBC", floor: "#C8BBA1", wall: "#EFE6D6", ceiling: "#F6F0E3", frame: "#FCFBF7", placeholder: "#D9D0BF" },
  },
  {
    id: "sage",
    name: "Xanh rêu",
    pal: { bg: "#D8DED4", bgTop: "#E8ECE3", bgBottom: "#C6CEC0", floor: "#BCC2B3", wall: "#DDE2D5", ceiling: "#EDF0E7", frame: "#FBFBF8", placeholder: "#CBD0C1" },
  },
  {
    id: "dark",
    name: "Triển lãm tối",
    pal: { bg: "#242428", bgTop: "#34343A", bgBottom: "#1B1B1F", floor: "#37373C", wall: "#2C2C31", ceiling: "#232327", frame: "#DADADD", placeholder: "#43434A" },
  },
];

export const galleryPalette = (id: string | undefined): GalleryPalette =>
  (GALLERY_PRESETS.find((p) => p.id === id) ?? GALLERY_PRESETS[0]).pal;
