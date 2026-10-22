import type { Client, ClientPic } from "@/types";

/**
 * Daftar PIC klien dari master data.
 *
 * Sumber utama adalah `client.pics` (terstruktur per baris). Data lama yang
 * belum punya kolom tersebut dibaca dari `pic_name`/`pic_contact` (dipisah
 * titik koma) dengan pasangan berdasarkan indeks.
 */
export function getClientPics(client: Client | null | undefined): ClientPic[] {
  if (!client) return [];

  if (client.pics?.length) {
    return client.pics
      .filter((pic) => pic?.name?.trim())
      .map((pic) => ({
        name: pic.name.trim(),
        contact: pic.contact?.trim() || null,
      }));
  }

  const names = (client.pic_name || "").split(";").map((n) => n.trim());
  const contacts = (client.pic_contact || "").split(";").map((c) => c.trim());
  return names
    .map((name, index) => ({
      name,
      contact: contacts[index]?.trim() || null,
    }))
    .filter((pic) => pic.name.length > 0);
}

/** Daftar nama PIC klien saja (dipakai untuk pilihan PIC posisi). */
export function getClientPicNames(client: Client | null | undefined): string[] {
  return getClientPics(client).map((pic) => pic.name);
}
