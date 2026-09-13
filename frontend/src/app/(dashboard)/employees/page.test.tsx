import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import EmployeesPage from './page';
import * as employeesApi from '@/lib/api/employees';

// Mock API
jest.mock('@/lib/api/employees');

// Mock Next.js Link
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => {
    return (
      <a href={href} data-testid="next-link">
        {children}
      </a>
    );
  },
}));

const mockEmployees = [
  {
    id: 'emp-1',
    full_name: 'John Doe',
    phone_number: '+628123456789',
    identity_no: '123456789012345678',
    employee_nip: 'NIP001',
    placement: ' Jakarta',
    role_level: ' Senior Developer',
    employee_status: 'aktif' as const,
    contract_duration_running: 12,
    age: 30,
  },
  {
    id: 'emp-2',
    full_name: 'Jane Smith',
    phone_number: '+628987654321',
    identity_no: '987654321098765432',
    employee_nip: 'NIP002',
    placement: ' Bandung',
    role_level: ' Project Manager',
    employee_status: 'cuti' as const,
    contract_duration_running: 6,
    age: 35,
  },
  {
    id: 'emp-3',
    full_name: 'Bob Wilson',
    phone_number: '+628112233445',
    identity_no: '112233445566778899',
    employee_nip: 'NIP003',
    placement: ' Surabaya',
    role_level: ' HR Manager',
    employee_status: 'resign' as const,
    contact_duration_running: null,
    age: 28,
  },
];

const createQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
};

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = createQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('Employees Page - Test Scenarios', () => {
  const fetchEmployees = employeesApi.fetchEmployees as jest.MockedFunction<typeof employeesApi.fetchEmployees>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering Tests', () => {
    it('renders page title and subtitle correctly', async () => {
      fetchEmployees.mockResolvedValue([]);

      render(EmployeesPage());

      expect(screen.getByText('Monitoring Outsource')).toBeInTheDocument();
      expect(screen.getByText('Karyawan')).toBeInTheDocument();
    });

    it('renders all filter options', async () => {
      fetchEmployees.mockResolvedValue([]);

      render(EmployeesPage());

      expect(screen.getByText('Status Karyawan')).toBeInTheDocument();
      expect(screen.getByText('Penempatan')).toBeInTheDocument();
      expect(screen.getByText('Kontrak habis dalam')).toBeInTheDocument();
    });

    it('renders correct status options in dropdown', async () => {
      fetchEmployees.mockResolvedValue([]);

      render(EmployeesPage());

      const statusSelect = screen.getByRole('combobox', { name: /status karyawan/i });
      expect(statusSelect).toHaveTextContent('Semua');
    });
  });

  describe('Loading States', () => {
    it('displays loading message when fetching data', async () => {
      fetchEmployees.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

      render(EmployeesPage());

      expect(screen.getByText('Memuat data karyawan…')).toBeInTheDocument();
    });

    it('shows empty state when no employees exist', async () => {
      fetchEmployees.mockResolvedValue([]);

      render(EmployeesPage());

      await waitFor(() => {
        expect(screen.getByText('Belum ada karyawan.')).toBeInTheDocument();
      });
    });
  });

  describe('Data Display', () => {
    it('displays employee names in the table', async () => {
      fetchEmployees.mockResolvedValue(mockEmployees);

      render(EmployeesPage());

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
        expect(screen.getByText('Bob Wilson')).toBeInTheDocument();
      });
    });

    it('displays employee NIK and NIP correctly', async () => {
      fetchEmployees.mockResolvedValue(mockEmployees);

      render(EmployeesPage());

      await waitFor(() => {
        expect(screen.getByText('123456789012345678')).toBeInTheDocument();
        expect(screen.getByText('NIP001')).toBeInTheDocument();
      });
    });

    it('displays employee placement correctly', async () => {
      fetchEmployees.mockResolvedValue(mockEmployees);

      render(EmployeesPage());

      await waitFor(() => {
        expect(screen.getByText(' Jakarta')).toBeInTheDocument();
        expect(screen.getByText(' Bandung')).toBeInTheDocument();
        expect(screen.getByText(' Surabaya')).toBeInTheDocument();
      });
    });

    it('displays employee role level correctly', async () => {
      fetchEmployees.mockResolvedValue(mockEmployees);

      render(EmployeesPage());

      await waitFor(() => {
        expect(screen.getByText('Senior Developer')).toBeInTheDocument();
        expect(screen.getByText('Project Manager')).toBeInTheDocument();
        expect(screen.getByText('HR Manager')).toBeInTheDocument();
      });
    });

    it('displays employee age correctly', async () => {
      fetchEmployees.mockResolvedValue(mockEmployees);

      render(EmployeesPage());

      await waitFor(() => {
        expect(screen.getByText('30 thn')).toBeInTheDocument();
        expect(screen.getByText('35 thn')).toBeInTheDocument();
        expect(screen.getByText('28 thn')).toBeInTheDocument();
      });
    });
  });

  describe('Status Badge Tests', () => {
    it('displays green badge for aktif status', async () => {
      fetchEmployees.mockResolvedValue([mockEmployees[0]]);

      render(EmployeesPage());

      await waitFor(() => {
        const badge = screen.getByText('Aktif');
        expect(badge).toBeInTheDocument();
        expect(badge).toHaveClass('bg-emerald-100');
      });
    });

    it('displays yellow badge for cuti status', async () => {
      fetchEmployees.mockResolvedValue([mockEmployees[1]]);

      render(EmployeesPage());

      await waitFor(() => {
        const badge = screen.getByText('Cuti');
        expect(badge).toBeInTheDocument();
        expect(badge).toHaveClass('bg-amber-100');
      });
    });

    it('displays red badge for resign status', async () => {
      fetchEmployees.mockResolvedValue([mockEmployees[2]]);

      render(EmployeesPage());

      await waitFor(() => {
        const badge = screen.getByText('Resign');
        expect(badge).toBeInTheDocument();
        expect(badge).toHaveClass('bg-red-100');
      });
    });
  });

  describe('Contract Duration Tests', () => {
    it('displays contract duration for employees with contracts', async () => {
      fetchEmployees.mockResolvedValue([mockEmployees[0]]);

      render(EmployeesPage());

      await waitFor(() => {
        expect(screen.getByText('12 bln')).toBeInTheDocument();
      });
    });

    it('shows dash for employees without contract duration', async () => {
      fetchEmployees.mockResolvedValue([mockEmployees[2]]);

      render(EmployeesPage());

      await waitFor(() => {
        const dashElements = screen.getAllByText('-');
        expect(dashElements.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Filter Functionality Tests', () => {
    it('calls API with status filter value', async () => {
      fetchEmployees.mockResolvedValue([]);

      render(EmployeesPage());

      const statusSelect = screen.getByRole('combobox', { name: /status karyawan/i });
      await userEvent.selectOptions(statusSelect, 'aktif');

      await waitFor(() => {
        expect(fetchEmployees).toHaveBeenCalledWith({ status: 'aktif' });
      });
    });

    it('calls API with placement filter value', async () => {
      fetchEmployees.mockResolvedValue([]);

      render(EmployeesPage());

      const placementInput = screen.getByPlaceholderText('Cari penempatan…');
      await userEvent.type(placementInput, 'Jakarta');

      await waitFor(() => {
        expect(fetchEmployees).toHaveBeenCalled();
      });
    });

    it('calls API with expiry days filter', async () => {
      fetchEmployees.mockResolvedValue([]);

      render(EmployeesPage());

      const expirySelect = screen.getByRole('combobox', { name: /kontrak habis dalam/i });
      await userEvent.selectOptions(expirySelect, '7');

      await waitFor(() => {
        expect(fetchEmployees).toHaveBeenCalled();
      });
    });
  });

  describe('View Details Link Tests', () => {
    it('renders view details link for each employee', async () => {
      fetchEmployees.mockResolvedValue(mockEmployees);

      render(EmployeesPage());

      await waitFor(() => {
        const links = screen.getAllByTestId('next-link');
        expect(links).toHaveLength(3);
        expect(links[0]).toHaveAttribute('href', '/employees/emp-1');
        expect(links[1]).toHaveAttribute('href', '/employees/emp-2');
        expect(links[2]).toHaveAttribute('href', '/employees/emp-3');
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles employee with missing optional fields', async () => {
      fetchEmployees.mockResolvedValue([{
        id: 'emp-4',
        full_name: 'Test User',
        employee_status: 'aktif',
      }]);

      render(EmployeesPage());

      await waitFor(() => {
        expect(screen.getByText('Test User')).toBeInTheDocument();
      });
    });
  });
});