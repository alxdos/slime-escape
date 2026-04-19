# Design Decisions

Короткие инженерные решения проекта. Один файл = одно решение. Формат и правила ведения описаны в [decision-log-format.md](decision-log-format.md).

| Decision | Status | Description |
|----------|--------|-------------|
| [decision-log-format.md](decision-log-format.md) | accepted | Формат файлов решений, правила именования и индексирования |
| [session-definition.md](session-definition.md) | accepted | Структура `SessionDefinition`, `EncounterDefinition` и `ModePreset` |
| [thread-model.md](thread-model.md) | accepted | Граница между `main thread`, `simulation worker` и рендером |
| [runtime-systems.md](runtime-systems.md) | accepted | Минимальный набор систем `core runtime` для MVP |
| [content-boundaries.md](content-boundaries.md) | accepted | Разделение `content library`, конфигурации сессии и runtime state |
| [_template.md](_template.md) | template | Минимальный шаблон нового решения |
