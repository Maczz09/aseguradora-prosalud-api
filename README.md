# Aseguradora ProSalud API

Sistema simulado de Seguros Médicos diseñado para integrarse con sistemas clínicos (como MediCitas). Está construido con arquitectura orientada a la resiliencia y tolerancia a fallos, utilizando un stack tecnológico moderno.

## 🚀 Arquitectura y Tecnologías

- **Plataforma:** Node.js 22 + Express.js
- **Base de Datos:** MySQL 8.0
- **Message Broker:** RabbitMQ
- **Documentación:** Swagger (OpenAPI 3.0)
- **Despliegue:** Docker & Docker Compose (Entorno Standalone)

## 🛡️ Patrones de Resiliencia Implementados

Este servicio no es solo un CRUD básico; incluye patrones listos para producción diseñados para evitar fallos en cascada:

1. **Backpressure (Bulkhead):** Un middleware protege la API rechazando rápidamente (Fail-fast con error HTTP `503`) solicitudes entrantes cuando se supera el límite de concurrencia máxima (`MAX_SOLICITUDES_CONCURRENTES`), evitando el colapso del servidor por falta de memoria.
2. **Transactional Outbox:** Las validaciones de cobertura se responden de forma síncrona, pero el registro de auditoría se guarda en una tabla local (`outbox`) y un Worker lo publica asíncronamente en RabbitMQ. Esto garantiza que una caída del broker no retrase ni afecte las respuestas en tiempo real de la API.
3. **Autenticación:** Rutas protegidas vía API Key (`X-Api-Key`).

## 🛠️ Cómo Ejecutar el Proyecto

El proyecto está dockerizado para que todos los servicios (API, MySQL, RabbitMQ) se levanten juntos en su propia red de forma independiente.

```bash
# Clonar el repositorio
git clone https://github.com/Maczz09/aseguradora-prosalud-api.git
cd aseguradora-prosalud-api

# Levantar toda la infraestructura (en segundo plano)
docker compose up --build -d
```

### Puertos Expuestos

- **API Aseguradora:** `http://localhost:4001`
- **MySQL:** `localhost:3311`
- **RabbitMQ Management UI:** `http://localhost:15673` (Usuario: `aseguradora_rabbit_user` / Contraseña: `rabbit_secret_aseguradora`)

## 📚 Documentación de la API (Swagger)

Una vez que el servidor esté corriendo, puedes visualizar e interactuar con la documentación en Swagger accediendo a:

👉 **[http://localhost:4001/api-docs](http://localhost:4001/api-docs)**

Para probar los endpoints desde Swagger, usa el botón **Authorize** en la parte superior derecha e ingresa la API Key por defecto configurada en tu `.env` (por defecto: `prosalud_secret_key_2026`).

## 🔌 Endpoints

Todos requieren la cabecera `X-Api-Key`.

### `GET /api/v1/asegurados/validar`

Valida si un documento tiene una póliza **vigente**.

- **Query:** `tipoDocumento` (`DNI` | `CE` | `PASAPORTE`), `numeroDocumento`
- **200:** `{ asegurado: true, numeroPoliza, plan, porcentajeCobertura, vigencia }` — o `{ asegurado: false }` si no existe / vencida / suspendida.

### `POST /api/v1/asegurados`

Registra un nuevo asegurado junto con su póliza (porcentaje de cobertura) de forma **atómica** (transacción).

- **Body obligatorio:** `nombre`, `apellido`, `tipoDocumento`, `numeroDocumento`, `porcentajeCobertura` (0–100).
- **Body opcional:** `plan` (por defecto `Plan Estándar`), `numeroPoliza` (autogenerado `POL-<año>-<hex>`), `fechaInicio` (hoy), `fechaFin` (+1 año), `estado` (`VIGENTE`), `fechaNacimiento`.
- **Respuestas:** `201` creado · `400` datos inválidos · `409` documento o póliza duplicados · `401` API Key.

```bash
curl -X POST http://localhost:4001/api/v1/asegurados \
  -H "X-Api-Key: prosalud_secret_key_2026" -H "Content-Type: application/json" \
  -d '{"nombre":"Juan","apellido":"Pérez","tipoDocumento":"DNI","numeroDocumento":"55667788","porcentajeCobertura":75}'
```

#### Validación del número de documento (según tipo)

El número se valida en el servidor según el tipo de documento:

| Tipo | Regla | Ejemplo |
| :--- | :--- | :--- |
| `DNI` | Exactamente **8 dígitos** numéricos | `12345678` |
| `CE` | **6 a 12** caracteres alfanuméricos | `CE123456` |
| `PASAPORTE` | **6 a 12** caracteres alfanuméricos | `US9988776` |

Si el formato no coincide, la API responde `400` con un mensaje explicando la regla del tipo enviado.

## 🧪 Datos de Prueba (Seeding)

La base de datos arranca automáticamente con información precargada. Usa los siguientes datos en el endpoint `GET /api/v1/asegurados/validar` para comprobar los distintos flujos:

| Documento | Tipo | Resultado Esperado | Detalles |
| :--- | :--- | :--- | :--- |
| `12345678` | DNI | **Asegurado (APROBADA)** | Póliza Vigente, 80% Cobertura |
| `87654321` | DNI | **Asegurado (APROBADA)** | Póliza Vigente, 100% Cobertura |
| `A1234567` | PASAPORTE | **Asegurado (APROBADA)** | Póliza Vigente, 50% Cobertura |
| `11223344` | DNI | **No Asegurado (RECHAZADA)** | Póliza Vencida en 2023 |
| `99999999` | DNI | **No Asegurado (RECHAZADA)** | Documento no existe en BD |

---
**Nota sobre Integración (MediCitas):**
Si estás integrando esto con el backend de MediCitas ejecutándose en Docker, recuerda que tu `ASEGURADORA_API_URL` en el `.env` del cliente debe apuntar a `http://host.docker.internal:4001/api/v1` para que los contenedores puedan comunicarse correctamente con el localhost de tu máquina.
