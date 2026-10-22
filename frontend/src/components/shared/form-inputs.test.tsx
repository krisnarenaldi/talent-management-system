import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import RupiahInput from "@/components/shared/RupiahInput";
import TagInput from "@/components/shared/TagInput";

function TagHarness({ initial = [] as string[] }) {
  const [tags, setTags] = useState<string[]>(initial);
  return (
    <>
      <TagInput value={tags} onChange={setTags} placeholder="Joni, Ahmad" />
      <span data-testid="tags">{tags.join("|")}</span>
    </>
  );
}

function RupiahHarness({ initial }: { initial?: number }) {
  const [value, setValue] = useState<number | undefined>(initial);
  return (
    <>
      <RupiahInput value={value} onChange={setValue} placeholder="15.000.000" />
      <span data-testid="value">{value ?? ""}</span>
    </>
  );
}

describe("TagInput", () => {
  it("menambahkan tag dengan Enter dan koma serta menolak duplikat", async () => {
    const user = userEvent.setup();
    render(<TagHarness />);

    const input = screen.getByPlaceholderText("Joni, Ahmad");
    await user.type(input, "Joni{enter}");
    await user.type(input, "Ahmad,");
    await user.type(input, "joni{enter}");

    expect(screen.getByTestId("tags")).toHaveTextContent("Joni|Ahmad");
  });

  it("menghapus tag dengan tombol close", async () => {
    const user = userEvent.setup();
    render(<TagHarness initial={["Joni", "Ahmad"]} />);

    await user.click(screen.getByRole("button", { name: "Hapus Joni" }));

    expect(screen.getByTestId("tags")).toHaveTextContent("Ahmad");
  });
});

describe("RupiahInput", () => {
  it("memformat input menjadi gaya ribuan Indonesia", async () => {
    const user = userEvent.setup();
    render(<RupiahHarness />);

    const input = screen.getByPlaceholderText("15.000.000");
    await user.type(input, "15000000");

    expect(input).toHaveValue("15.000.000");
    expect(screen.getByTestId("value")).toHaveTextContent("15000000");
  });

  it("menampilkan nilai awal yang sudah diformat", () => {
    render(<RupiahHarness initial={25000000} />);

    expect(screen.getByPlaceholderText("15.000.000")).toHaveValue("25.000.000");
  });
});
