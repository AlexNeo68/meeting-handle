import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import FileUpload, { MAX_FILE_SIZE } from './file-upload';

const mockUseAuth = vi.fn();

const { toastDanger, toastSuccess } = vi.hoisted(() => ({
  toastDanger: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('@heroui/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@heroui/react')>();
  return {
    ...actual,
    toast: { danger: toastDanger, success: toastSuccess },
  };
});

class FakeXMLHttpRequest {
  static instances: FakeXMLHttpRequest[] = [];
  upload = {
    onprogress: null as
      null | ((e: { lengthComputable: boolean; loaded: number; total: number }) => void),
    onload: null as null | (() => void),
  };
  onload: null | (() => void) = null;
  onerror: null | (() => void) = null;
  onabort: null | (() => void) = null;
  status = 0;
  responseText = '';
  url = '';
  method = '';
  requestHeaders: Record<string, string> = {};

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(name: string, value: string) {
    this.requestHeaders[name] = value;
  }

  send() {
    FakeXMLHttpRequest.instances.push(this);
  }
}

function makeFile(name: string, type: string, size = 100): File {
  return new File([new ArrayBuffer(size)], name, { type });
}

function renderUpload() {
  const onUploaded = vi.fn();
  vi.stubGlobal('XMLHttpRequest', FakeXMLHttpRequest);
  mockUseAuth.mockReturnValue({
    token: 'jwt-token',
    user: { id: 'user-1', email: 'test@example.com' },
    isAuthenticated: true,
    login: vi.fn(),
    logout: vi.fn(),
  });
  const utils = render(<FileUpload meetingId="meeting-1" onUploaded={onUploaded} />);
  return { onUploaded, ...utils };
}

function selectFile(file: File) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
}

afterEach(() => {
  FakeXMLHttpRequest.instances = [];
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('FileUpload', () => {
  it('renders upload zone and button', () => {
    renderUpload();

    expect(screen.getAllByLabelText('Загрузить файл')).toHaveLength(2);
    expect(screen.getByText(/Перетащите файл сюда/)).toBeInTheDocument();
    expect(document.querySelector('input[type="file"]')).toHaveAttribute('accept');
  });

  it('triggers upload on file selection and reports progress', async () => {
    const { onUploaded } = renderUpload();

    selectFile(makeFile('notes.pdf', 'application/pdf'));

    await waitFor(() => {
      expect(FakeXMLHttpRequest.instances).toHaveLength(1);
    });

    const xhr = FakeXMLHttpRequest.instances[0];
    expect(xhr.method).toBe('POST');
    expect(xhr.url).toBe('/api/meetings/meeting-1/files');
    expect(xhr.requestHeaders.Authorization).toBe('Bearer jwt-token');

    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 });

    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');

    xhr.status = 201;
    xhr.responseText = JSON.stringify({
      id: 'file-1',
      originalName: 'notes.pdf',
      mimeType: 'application/pdf',
      size: 100,
      createdAt: '2026-07-31T08:00:00.000Z',
    });
    xhr.onload?.();

    await waitFor(() => {
      expect(onUploaded).toHaveBeenCalledWith(expect.objectContaining({ id: 'file-1' }));
    });
  });

  it('switches to indeterminate progress while the server processes', async () => {
    const { onUploaded } = renderUpload();

    selectFile(makeFile('notes.pdf', 'application/pdf'));

    await waitFor(() => {
      expect(FakeXMLHttpRequest.instances).toHaveLength(1);
    });

    const xhr = FakeXMLHttpRequest.instances[0];
    xhr.upload.onload?.();

    await waitFor(() => {
      const progressbar = screen.getByRole('progressbar');
      expect(progressbar).not.toHaveAttribute('aria-valuenow');
      expect(progressbar).toHaveAttribute('aria-label', 'Обработка файла');
    });
    expect(screen.getByText('Обработка...')).toBeInTheDocument();

    xhr.status = 201;
    xhr.responseText = JSON.stringify({
      id: 'file-1',
      originalName: 'notes.pdf',
      mimeType: 'application/pdf',
      size: 100,
      createdAt: '2026-07-31T08:00:00.000Z',
    });
    xhr.onload?.();

    await waitFor(() => {
      expect(onUploaded).toHaveBeenCalledWith(expect.objectContaining({ id: 'file-1' }));
    });
  });

  it('shows size validation error for files over 100 MB', () => {
    renderUpload();

    selectFile(makeFile('big.mp4', 'video/mp4', MAX_FILE_SIZE + 1));

    expect(screen.getByRole('alert')).toHaveTextContent(/слишком большой/i);
    expect(FakeXMLHttpRequest.instances).toHaveLength(0);
  });

  it('exposes validation error to screen readers via aria-live', () => {
    renderUpload();

    selectFile(makeFile('big.mp4', 'video/mp4', MAX_FILE_SIZE + 1));

    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('aria-live', 'polite');
  });

  it('shows type validation error for unsupported mime types', () => {
    renderUpload();

    selectFile(makeFile('malware.exe', 'application/x-msdownload'));

    expect(screen.getByRole('alert')).toHaveTextContent(/неподдерживаемый тип/i);
    expect(FakeXMLHttpRequest.instances).toHaveLength(0);
  });

  it('shows network toast on upload error', async () => {
    renderUpload();

    selectFile(makeFile('notes.pdf', 'application/pdf'));

    await waitFor(() => {
      expect(FakeXMLHttpRequest.instances).toHaveLength(1);
    });

    FakeXMLHttpRequest.instances[0].onerror?.();

    await waitFor(() => {
      expect(toastDanger).toHaveBeenCalledWith(expect.stringMatching(/сети/i));
    });
  });
});
