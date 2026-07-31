import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import FileList from './file-list';

const mockUseAuth = vi.fn();

const { toastDanger } = vi.hoisted(() => ({ toastDanger: vi.fn() }));

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('@heroui/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@heroui/react')>();
  return {
    ...actual,
    toast: { danger: toastDanger },
  };
});

const mockFiles = [
  {
    id: 'file-1',
    originalName: 'заметки.pdf',
    mimeType: 'application/pdf',
    size: 2048,
    createdAt: '2026-07-30T09:00:00.000Z',
  },
  {
    id: 'file-2',
    originalName: 'запись.mp4',
    mimeType: 'video/mp4',
    size: 5 * 1024 * 1024,
    createdAt: '2026-07-29T10:00:00.000Z',
  },
];

function renderList(overrides: Partial<{ fetchImpl: typeof fetch; files: typeof mockFiles }> = {}) {
  mockUseAuth.mockReturnValue({
    token: 'jwt-token',
    user: { id: 'user-1', email: 'test@example.com' },
    isAuthenticated: true,
    login: vi.fn(),
    logout: vi.fn(),
  });

  const files = overrides.files ?? mockFiles;
  vi.stubGlobal(
    'fetch',
    overrides.fetchImpl ??
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ files }),
      }),
  );

  const utils = render(<FileList meetingId="meeting-1" />);
  return { files, ...utils };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('FileList', () => {
  it('renders empty state with icon and CTA', async () => {
    renderList({ files: [] });

    await waitFor(() => {
      expect(screen.getByText('Файлы ещё не загружены')).toBeInTheDocument();
    });
  });

  it('renders loading skeletons while fetching', () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));
    mockUseAuth.mockReturnValue({
      token: 'jwt-token',
      user: { id: 'user-1', email: 'test@example.com' },
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
    });

    render(<FileList meetingId="meeting-1" />);

    const loading = screen.getByLabelText('Загрузка файлов');
    expect(loading).toBeInTheDocument();
    expect(loading.getAttribute('aria-busy')).toBe('true');
    expect(loading.children.length).toBe(3);
  });

  it('renders file items with correct data', async () => {
    renderList();

    await waitFor(() => {
      expect(screen.getByRole('list', { name: 'Meeting files' })).toBeInTheDocument();
    });

    expect(screen.getByText('заметки.pdf')).toBeInTheDocument();
    expect(screen.getByText('запись.mp4')).toBeInTheDocument();
    expect(screen.getByText(/2 КБ/)).toBeInTheDocument();
    expect(screen.getByText(/5[.,]0 МБ/)).toBeInTheDocument();
  });

  it('triggers download and creates a blob link', async () => {
    const createObjectURL = vi.fn(() => 'blob:fake-url');
    class MockURL extends URL {
      static createObjectURL = createObjectURL;
      static revokeObjectURL = vi.fn();
    }
    vi.stubGlobal('URL', MockURL);

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: mockFiles }),
      })
      .mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(['content'], { type: 'application/pdf' }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    renderList({ fetchImpl: fetchMock as unknown as typeof fetch });

    await waitFor(() => {
      expect(screen.getByRole('list', { name: 'Meeting files' })).toBeInTheDocument();
    });

    const downloadButton = screen.getAllByLabelText('Скачать файл')[0];
    fireEvent.click(downloadButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/meetings/meeting-1/files/file-1/download',
        expect.objectContaining({
          headers: { Authorization: 'Bearer jwt-token' },
        }),
      );
    });

    await waitFor(() => {
      expect(anchorClick).toHaveBeenCalled();
    });
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
  });

  it('shows confirmation dialog on delete and removes item after confirm', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: mockFiles }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });
    vi.stubGlobal('fetch', fetchMock);

    renderList({ fetchImpl: fetchMock as unknown as typeof fetch });

    await waitFor(() => {
      expect(screen.getByRole('list', { name: 'Meeting files' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByLabelText('Удалить файл')[0]);

    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('Удалить файл?')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Удалить' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/meetings/meeting-1/files/file-1',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    await waitFor(() => {
      expect(screen.queryByText('заметки.pdf')).not.toBeInTheDocument();
    });
    expect(screen.getByText('запись.mp4')).toBeInTheDocument();
  });
});
