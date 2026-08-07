import { describe, expect, it } from 'vitest';
import { translateApiError } from './api-errors';

describe('translateApiError', () => {
  it('maps known profile/avatar server messages to Russian', () => {
    expect(translateApiError('Unsupported avatar type')).toBe(
      'Неподдерживаемый формат изображения.',
    );
    expect(translateApiError('Avatar file is required')).toBe('Не выбран файл изображения.');
    expect(translateApiError('Avatar content does not match allowed image types')).toBe(
      'Содержимое файла не соответствует допустимым типам изображений.',
    );
    expect(translateApiError('Email already exists')).toBe('Этот email уже занят');
  });

  it('maps DTO validation messages to Russian', () => {
    expect(translateApiError('Name must not be empty')).toBe('Имя не может быть пустым');
    expect(translateApiError('email must be an email')).toBe('Введите корректный email адрес');
    expect(translateApiError('password must be longer than or equal to 6 characters')).toBe(
      'Пароль должен содержать минимум 6 символов',
    );
    expect(translateApiError('password must be a string')).toBe('Пароль должен быть строкой');
  });

  it('maps the duplicate-password rejection to Russian', () => {
    expect(translateApiError('New password must differ from the current one')).toBe(
      'Новый пароль должен отличаться от текущего',
    );
  });

  it('maps file size-limit messages to Russian regardless of the limit', () => {
    expect(translateApiError('File size exceeds 5 MB limit')).toBe('Файл слишком большой');
    expect(translateApiError('File size exceeds 100 MB limit')).toBe('Файл слишком большой');
    expect(
      translateApiError(['File size exceeds 5 MB limit'], 'Не удалось загрузить аватар'),
    ).toBe('Файл слишком большой');
  });

  it('maps generic server errors to Russian', () => {
    expect(translateApiError('Insufficient storage')).toBe('Недостаточно места на сервере');
    expect(translateApiError('Too Many Requests')).toBe('Слишком много попыток. Попробуйте позже.');
    expect(translateApiError('Internal server error')).toBe(
      'Внутренняя ошибка сервера. Попробуйте ещё раз.',
    );
  });

  it('maps transcription server messages to Russian', () => {
    expect(translateApiError('Transcription not completed')).toBe('Транскрибация ещё не завершена');
    expect(translateApiError('Transcription disabled')).toBe('Транскрибация отключена');
    expect(translateApiError('Transcription already in progress')).toBe(
      'Транскрибация уже выполняется',
    );
    expect(translateApiError('Transcription not available')).toBe('Транскрибация недоступна');
    expect(translateApiError('Interrupted by server restart')).toBe(
      'Транскрибация прервана перезапуском сервера',
    );
    expect(translateApiError('ffmpeg not found')).toBe('ffmpeg не установлен');
    expect(translateApiError('No audio stream')).toBe('В файле нет аудиодорожки');
    expect(translateApiError('Model not downloaded')).toBe(
      'Модель транскрибации не загружена',
    );
    expect(translateApiError('whisper-cli binary is not built')).toBe(
      'Движок транскрибации не собран',
    );
    expect(translateApiError('Invalid file path')).toBe('Недопустимый путь к файлу');
  });

  it('uses the provided fallback for unknown messages', () => {
    expect(translateApiError('Some unknown error', 'Не удалось удалить аватар')).toBe(
      'Не удалось удалить аватар',
    );
  });

  it('returns generic fallback when the message is missing', () => {
    expect(translateApiError(null)).toBe('Что-то пошло не так. Попробуйте ещё раз.');
    expect(translateApiError(undefined)).toBe('Что-то пошло не так. Попробуйте ещё раз.');
  });

  it('maps array messages using the first element', () => {
    expect(translateApiError(['Email already exists', 'another error'])).toBe(
      'Этот email уже занят',
    );
  });
});
