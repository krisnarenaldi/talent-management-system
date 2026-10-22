import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import NewApplicationPage from "./page";
import api from "@/lib/api";
import { positionsApi } from "@/lib/api/positions";
import { useAuthStore } from "@/stores/auth.store";
import { useToastStore } from "@/stores/toast.store";
import type { Position } from "@/types";

jest.mock("@/lib/api", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

jest.mock("@/lib/api/positions", () => ({
  positionsApi: { listActive: jest.fn(), getById: jest.fn() },
}));

jest.mock("@/lib/api/settings", () => ({
  settingsApi: { listSourceChannels: jest.fn().mockResolvedValue([]) },
}));

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <a href="#">{children}</a>,
}));

const mockPositions: Position[] = [
  {
    id: "pos-1",
    client_id: "client-1",
    client_name: "Pinhome",
    title: "Backend Engineer",
    requirement: null,
    job_description: null,
    employment_type: "PKWT",
    contract_duration_months: 12,
    is_active: true,
    ai_scoring_config: null,
    salary_budget: 15000000,
    location: "Jakarta",
    client_user_names: ["Joni", "Ahmad"],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "pos-2",
    client_id: "client-2",
    client_name: "Bank Mandiri",
    title: "Data Analyst",
    requirement: null,
    job_description: null,
    employment_type: null,
    contract_duration_months: null,
    is_active: true,
    ai_scoring_config: null,
    salary_budget: null,
    location: null,
    client_user_names: [],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
];

const mockRecommendations = {
  position_id: "pos-1",
  message: "Ditemukan 2 kandidat relevan",
  candidates: [
    {
      candidate_id: "cand-1",
      full_name: "Rahmat Surahmat",
      skills: ["Go", "PostgreSQL"],
      experience_years: 4,
      expected_salary: 14000000,
      domicile: "Jakarta",
      pool_status: "talent_pool",
      ai_score: 92,
      ai_notes: "Mahir Go dan microservices, 4 tahun pengalaman",
    },
    {
      candidate_id: "cand-2",
      full_name: "Krisna Renaldi",
      skills: ["SQL", "Python"],
      experience_years: 2,
      expected_salary: 12000000,
      domicile: "Bandung",
      pool_status: "database",
      ai_score: 55,
      ai_notes: "Kuat di SQL, pengalaman masih kurang",
    },
  ],
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <NewApplicationPage />
    </QueryClientProvider>
  );
}

/** Pilih posisi pada Pusat Sourcing agar form rekomendasi siap dipakai. */
async function selectBackendEngineer(user: ReturnType<typeof userEvent.setup>) {
  const searchInput = await screen.findByPlaceholderText("Cari posisi yang dilamar...");
  await user.click(searchInput);
  await user.click(await screen.findByText("Backend Engineer"));
}

/** Jalankan pencarian rekomendasi dan tunggu tabel hasil muncul. */
async function runRecommendation(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /Cari & Rekomendasikan Kandidat/i }));
  await screen.findByText("Rahmat Surahmat");
}

describe("Pusat Sourcing /applications/new", () => {
  let mockPush: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPush = jest.fn();
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush, replace: jest.fn() });

    useAuthStore.setState({
      user: { id: "u-1", name: "HR Altek", email: "hr@altek.co.id", role: "hr" },
      isLoading: false,
    });
    useToastStore.setState({ toasts: [] });

    (positionsApi.listActive as jest.Mock).mockResolvedValue(mockPositions);
    (api.post as jest.Mock).mockImplementation((url: string) => {
      if (url.includes("recommend-candidates")) {
        return Promise.resolve({ data: mockRecommendations });
      }
      if (url.includes("bulk-assign")) {
        return Promise.resolve({
          data: { success_count: 2, skipped_count: 0, skipped_details: [], message: "ok" },
        });
      }
      return Promise.resolve({ data: {} });
    });
  });

  it("menampilkan katalog posisi aktif saat input pencarian difokuskan", async () => {
    const user = userEvent.setup();
    renderPage();

    const searchInput = await screen.findByPlaceholderText("Cari posisi yang dilamar...");
    await user.click(searchInput);

    expect(await screen.findByText("Backend Engineer")).toBeInTheDocument();
    expect(screen.getByText("Data Analyst")).toBeInTheDocument();
  });

  it("memfilter posisi berdasarkan kata kunci", async () => {
    const user = userEvent.setup();
    renderPage();

    const searchInput = await screen.findByPlaceholderText("Cari posisi yang dilamar...");
    await user.click(searchInput);
    await user.type(searchInput, "Data");

    await waitFor(() => {
      expect(screen.queryByText("Backend Engineer")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Data Analyst")).toBeInTheDocument();
  });

  it("mengisi dropdown PIC User Klien dari master data posisi", async () => {
    const user = userEvent.setup();
    renderPage();

    const searchInput = await screen.findByPlaceholderText("Cari posisi yang dilamar...");
    await user.click(searchInput);
    await user.click(await screen.findByText("Backend Engineer"));

    const picSelect = await screen.findByDisplayValue("-- Pilih PIC User --");
    expect(picSelect).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Joni" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Ahmad" })).toBeInTheDocument();
  });

  it("mengirim posisi, sumber, dan PIC User ke endpoint rekomendasi", async () => {
    const user = userEvent.setup();
    renderPage();

    await selectBackendEngineer(user);
    await user.selectOptions(await screen.findByDisplayValue("-- Pilih PIC User --"), "Joni");
    await user.selectOptions(screen.getByLabelText("Sumber Kandidat"), "talent_pool");

    await user.click(screen.getByRole("button", { name: /Cari & Rekomendasikan Kandidat/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        "/api/v1/positions/pos-1/recommend-candidates",
        { source: "talent_pool", client_user_name: "Joni" }
      );
    });
  });

  it("menonaktifkan tombol rekomendasi sebelum posisi dipilih", async () => {
    renderPage();

    const button = await screen.findByRole("button", { name: /Cari & Rekomendasikan Kandidat/i });
    expect(button).toBeDisabled();
  });

  // ── TASK-21.2: Hasil rekomendasi & bulk pipeline insert ──────────────────

  it("menampilkan tabel rekomendasi lengkap dengan skor, alasan, dan status pool", async () => {
    const user = userEvent.setup();
    renderPage();

    await selectBackendEngineer(user);
    await runRecommendation(user);

    const table = within(screen.getByRole("table"));
    expect(table.getByText("Krisna Renaldi")).toBeInTheDocument();
    expect(table.getByText("92%")).toBeInTheDocument();
    expect(table.getByText("55%")).toBeInTheDocument();
    expect(
      table.getByText("Mahir Go dan microservices, 4 tahun pengalaman")
    ).toBeInTheDocument();
    expect(table.getByText("Talent Pool")).toBeInTheDocument();
    expect(table.getByText("Database")).toBeInTheDocument();
  });

  it("memilih semua rekomendasi lewat checkbox header", async () => {
    const user = userEvent.setup();
    renderPage();

    await selectBackendEngineer(user);
    await runRecommendation(user);

    await user.click(screen.getByLabelText("Pilih Semua Rekomendasi"));

    await waitFor(() => {
      expect(screen.getByText("2 dari 2 kandidat dipilih")).toBeInTheDocument();
    });
    expect(screen.getByLabelText("Pilih Rahmat Surahmat")).toBeChecked();
    expect(screen.getByLabelText("Pilih Krisna Renaldi")).toBeChecked();
  });

  it("memasukkan kandidat terpilih ke pipeline lalu redirect ke /applications", async () => {
    const user = userEvent.setup();
    renderPage();

    await selectBackendEngineer(user);
    await runRecommendation(user);

    await user.click(screen.getByLabelText("Pilih Rahmat Surahmat"));
    await user.click(
      screen.getByRole("button", { name: /Masukkan Kandidat Terpilih ke Pipeline Lamaran/i })
    );

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/api/v1/candidates/bulk-assign", {
        candidate_ids: ["cand-1"],
        position_id: "pos-1",
        client_user_name: undefined,
        run_ai_screening: false,
      });
    });
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/applications");
    });
  });

  it("menyembunyikan toggle AI Screening untuk role HR", async () => {
    const user = userEvent.setup();
    renderPage();

    await selectBackendEngineer(user);
    await runRecommendation(user);

    expect(screen.queryByText("Jalankan AI Screening")).not.toBeInTheDocument();
  });

  it("menampilkan toggle AI Screening untuk role Manager", async () => {
    useAuthStore.setState({
      user: { id: "u-2", name: "Manager Altek", email: "mgr@altek.co.id", role: "manager" },
    });
    const user = userEvent.setup();
    renderPage();

    await selectBackendEngineer(user);
    await runRecommendation(user);

    expect(screen.getByText("Jalankan AI Screening")).toBeInTheDocument();
  });
});
