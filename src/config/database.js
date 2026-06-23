'use strict';
require('dotenv').config();

const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:            process.env.DB_HOST     || 'localhost',
  port:            parseInt(process.env.DB_PORT || '3306'),
  user:            process.env.DB_USER     || 'aseguradora_app',
  password:        process.env.DB_PASSWORD || '',
  database:        process.env.DB_NAME     || 'db_aseguradora',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit:      0,
  timezone:        '+00:00',
});

module.exports = pool;
