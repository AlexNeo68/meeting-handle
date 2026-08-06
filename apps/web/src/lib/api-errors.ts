// Error message language strategy:
// The API returns user-facing errors in English as stable keys. This module is
// the single place that translates them to Russian for the UI. The server must
// not send localized (e.g. Russian) messages — the frontend owns all user
// facing copy.

type ApiErrorInput = string | string[] | null | undefined;

const FALLBACK_API_ERROR = 'Что-то пошло не так. Попробуйте ещё раз.';

const FILE_SIZE_LIMIT_PATTERN = /^File size exceeds \d+ MB limit$/;

const API_ERROR_TRANSLATIONS: Record<string, string> = {
  'Unsupported avatar type': 'Неподдерживаемый формат изображения.',
  'Avatar file is required': 'Не выбран файл изображения.',
  'Avatar content does not match allowed image types':
    'Содержимое файла не соответствует допустимым типам изображений.',
  'Email already exists': 'Этот email уже занят',
  'Registration failed': 'Не удалось зарегистрироваться. Возможно, этот email уже занят',
  'Name must not be empty': 'Имя не может быть пустым',
  'email must be an email': 'Введите корректный email адрес',
  'password must be a string': 'Пароль должен быть строкой',
  'password must be longer than or equal to 6 characters':
    'Пароль должен содержать минимум 6 символов',
  'New password must differ from the current one': 'Новый пароль должен отличаться от текущего',
  'Insufficient storage': 'Недостаточно места на сервере',
  'Too Many Requests': 'Слишком много попыток. Попробуйте позже.',
  'Internal server error': 'Внутренняя ошибка сервера. Попробуйте ещё раз.',
};

export function translateApiError(message: ApiErrorInput, fallback = FALLBACK_API_ERROR): string {
  if (Array.isArray(message)) {
    return translateApiError(message[0], fallback);
  }
  if (!message) {
    return fallback;
  }
  if (FILE_SIZE_LIMIT_PATTERN.test(message)) {
    return 'Файл слишком большой';
  }
  return API_ERROR_TRANSLATIONS[message] ?? fallback;
}
