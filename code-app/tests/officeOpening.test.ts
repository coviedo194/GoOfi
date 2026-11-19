import assert from 'node:assert/strict';
import test from 'node:test';
import { getOfficeOpeningPermissions, getOfficeOpeningStatus } from '../src/utils/officeOpening.ts';

test('un usuario cargado con permiso desactivado o vacío cuenta como sin llave', () => {
  for (const user of [
    { systemuserid: 'ana', ovg_permisodeaperturadeoficina: false },
    { systemuserid: 'ana', ovg_permisodeaperturadeoficina: null },
    { systemuserid: 'ana' },
  ]) {
    assert.equal(getOfficeOpeningStatus(
      [{ _owninguser_value: 'ana' }],
      getOfficeOpeningPermissions([user]),
    ), 'uncovered');
  }
});

test('distingue un campo vacío de un usuario que no se ha podido cargar', () => {
  assert.equal(getOfficeOpeningStatus(
    [{ _owninguser_value: 'ana' }, { _owninguser_value: 'luis' }],
    getOfficeOpeningPermissions([{ systemuserid: 'ana' }]),
  ), 'unknown');
});

test('una llave confirmada cubre el día aunque otros usuarios tengan el campo vacío', () => {
  assert.equal(getOfficeOpeningStatus(
    [{ _owninguser_value: 'ana' }, { _owninguser_value: 'luis' }],
    getOfficeOpeningPermissions([
      { systemuserid: 'ana' },
      { systemuserid: 'luis', ovg_permisodeaperturadeoficina: true },
    ]),
  ), 'covered');
});

test('un día sin avisos está vacío aunque haya personas con llave en la semana', () => {
  assert.equal(getOfficeOpeningStatus([], new Map([['ana', true]])), 'empty');
});

test('un día con asistentes sin llave queda sin apertura', () => {
  assert.equal(getOfficeOpeningStatus(
    [{ _owninguser_value: 'ana' }, { _owninguser_value: 'luis' }],
    new Map([['ana', false], ['luis', false]]),
  ), 'uncovered');
});

test('basta con un asistente con llave, incluido el usuario actual', () => {
  assert.equal(getOfficeOpeningStatus(
    [{ _owninguser_value: 'yo' }, { _owninguser_value: 'ana' }],
    new Map([['yo', true], ['ana', false]]),
  ), 'covered');
});

test('no confunde un permiso sin cargar con una persona sin llave', () => {
  assert.equal(getOfficeOpeningStatus(
    [{ _owninguser_value: 'ana' }, { _owninguser_value: 'luis' }],
    new Map([['ana', false]]),
  ), 'unknown');
  assert.equal(getOfficeOpeningStatus([{}], new Map()), 'unknown');
});

test('una apertura confirmada basta aunque falten otros permisos', () => {
  assert.equal(getOfficeOpeningStatus(
    [{ _owninguser_value: 'ana' }, {}],
    new Map([['ana', true]]),
  ), 'covered');
});

test('el estado cambia al retirar al último asistente con llave', () => {
  const permissions = new Map([['ana', true], ['luis', false]]);
  const notices = [{ _owninguser_value: 'ana' }, { _owninguser_value: 'luis' }];
  assert.equal(getOfficeOpeningStatus(notices, permissions), 'covered');
  assert.equal(getOfficeOpeningStatus(notices.slice(1), permissions), 'uncovered');
  assert.equal(getOfficeOpeningStatus([], permissions), 'empty');
});
