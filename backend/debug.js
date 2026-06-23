const aiService = require('./src/services/aiService.js');

async function main() {
  try {
    console.log('Testing explainQuery with long prompt...');
    const result = await aiService.explainQuery(`-- Crear una base de datos llamada Tienda
CREATE DATABASE HOLA1;

-- Seleccionar la base de datos para usarla
USE HOLA1;

-- Borrar la base de datos (\u00a1Cuidado! Borra todo lo que tiene dentro)
--DROP DATABASE HOLA1;


CREATE TABLE Clientes (
    ID INT PRIMARY KEY,
    Nombre VARCHAR(50),
    Alta DATE
);

-- 2. Insertamos tres clientes de prueba
INSERT INTO Clientes (ID, Nombre, Alta) 
VALUES 
(1, 'Ana G\u00f3mez', '2026-01-15'),
(2, 'Luis P\u00e9rez', '2026-02-20'),
(3, 'Mar\u00eda L\u00f3pez', '2026-03-05');

SELECT * FROM Clientes;

SELECT * FROM sys.tables; 
SELECT * FROM sys.columns;`);
    console.log('Success:', result);
  } catch (err) {
    console.error('Caught error:', err);
  }
}

main();
