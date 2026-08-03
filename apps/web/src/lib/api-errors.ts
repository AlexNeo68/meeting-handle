type ApiErrorInput = string | string[] | null | undefined;

const FALLBACK_API_ERROR = 'Что-то пошло не так. Попробуйте ещё раз.';

const CYRILLIC_PATTERN = /[\u0400-\u04FF]/;

const API_ERROR_TRANSLATIONS: Record<string, string> = {
  'Unsupported avatar type': 'Неподдерживаемый формат изображения.',
  'Avatar file is required': 'Не выбран файл изображения.',
  'Avatar content does not match allowed image types':
    'Содержимое файла не соответствует допустимым типам изображений.',
  'Email already exists': 'Этот email уже занят',
  'Name must not be empty': 'Имя не может быть пустым',
  'email must be an email': 'Введите корректный email адрес',
  'password must be a string': 'Пароль должен быть строкой',
  'password must be longer than or equal to 6 characters':
    'Пароль должен содержать минимум 6 символов',
  'File size exceeds 100 MB limit': 'Файл слишком большой',
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
  if (CYRILLIC_PATTERN.test(message)) {
    return message;
  }
  return API_ERROR_TRANSLATIONS[message] ?? fallback;
}
