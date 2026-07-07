-- ── Schema db_aseguradora ──────────────────────────────────────────────────────
CREATE DATABASE IF NOT EXISTS db_aseguradora CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE db_aseguradora;

-- ── Usuarios de la aplicación ────────────────────────────────────────────────
CREATE USER IF NOT EXISTS 'aseguradora_app'@'%' IDENTIFIED BY 'app_secret_aseguradora';
GRANT SELECT, INSERT, UPDATE ON db_aseguradora.* TO 'aseguradora_app'@'%';
FLUSH PRIVILEGES;

-- ── Tabla: asegurados ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS asegurados (
  id_asegurado      VARCHAR(36)  NOT NULL DEFAULT (UUID()),
  nombre            VARCHAR(100) NOT NULL,
  apellido          VARCHAR(100) NOT NULL,
  tipo_documento    ENUM('DNI','CE','PASAPORTE') NOT NULL,
  numero_documento  VARCHAR(20)  NOT NULL,
  fecha_nacimiento  DATE         NULL,
  activo            TINYINT(1)   NOT NULL DEFAULT 1,
  created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id_asegurado),
  UNIQUE KEY uq_documento (tipo_documento, numero_documento)
);

-- ── Tabla: polizas ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS polizas (
  id_poliza            VARCHAR(36)   NOT NULL DEFAULT (UUID()),
  id_asegurado         VARCHAR(36)   NOT NULL,
  numero_poliza        VARCHAR(30)   NOT NULL,
  plan                 VARCHAR(100)  NOT NULL,
  porcentaje_cobertura DECIMAL(5,2)  NOT NULL,
  fecha_inicio         DATE          NOT NULL,
  fecha_fin            DATE          NOT NULL,
  estado               ENUM('VIGENTE','VENCIDA','SUSPENDIDA') NOT NULL DEFAULT 'VIGENTE',

  PRIMARY KEY (id_poliza),
  UNIQUE KEY uq_numero_poliza (numero_poliza),
  FOREIGN KEY (id_asegurado) REFERENCES asegurados(id_asegurado),
  INDEX idx_asegurado_estado (id_asegurado, estado)
);

-- ── Tabla: outbox (patrón Transactional Outbox para auditoría asíncrona) ──────
CREATE TABLE IF NOT EXISTS outbox (
  id              VARCHAR(36)  NOT NULL,
  evento          VARCHAR(60)  NOT NULL,         -- PolizaValidada | PolizaNoEncontrada
  payload         JSON         NOT NULL,
  publicado       TINYINT(1)   NOT NULL DEFAULT 0,
  intentos        INT          NOT NULL DEFAULT 0,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_publicado (publicado, created_at)
);

-- ── Tabla: webhooks_salientes (outbox local para entrega a MediCitas) ─────────
-- Si la entrega inmediata (con reintento en memoria) falla, el evento se
-- persiste aquí para que un worker en background siga reintentando con
-- backoff hasta que MediCitas vuelva a estar disponible — sin esto, un
-- webhook fallido se pierde para siempre y los dos sistemas quedan
-- desincronizados (ej. póliza SUSPENDIDA aquí pero VIGENTE en MediCitas).
CREATE TABLE IF NOT EXISTS webhooks_salientes (
  id                  VARCHAR(36)  NOT NULL DEFAULT (UUID()),
  tipo_evento         VARCHAR(60)  NOT NULL,
  payload             JSON         NOT NULL,
  url_destino         VARCHAR(255) NOT NULL,
  estado              ENUM('PENDIENTE','ENTREGADO','FALLIDO_PERMANENTE') NOT NULL DEFAULT 'PENDIENTE',
  intentos            INT          NOT NULL DEFAULT 0,
  proximo_intento_en  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ultimo_error        VARCHAR(500) NULL,
  created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_estado_proximo (estado, proximo_intento_en)
);

-- ── Tabla: historial_validaciones (log de auditoría — alimentado async) ───────
CREATE TABLE IF NOT EXISTS historial_validaciones (
  id                   VARCHAR(36)  NOT NULL DEFAULT (UUID()),
  tipo_documento       VARCHAR(20)  NOT NULL,
  numero_documento     VARCHAR(20)  NOT NULL,
  resultado            ENUM('VALIDADO','NO_ENCONTRADO') NOT NULL,
  numero_poliza        VARCHAR(30)  NULL,
  porcentaje_cobertura DECIMAL(5,2) NULL,
  procesado_en         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_documento (tipo_documento, numero_documento)
);
