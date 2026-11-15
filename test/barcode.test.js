import assert from 'node:assert/strict'
import { test } from 'node:test'
import { barcodeKind, checkDigit, expandUpcE, isUpcE } from '../js/barcode.js'
import { fetchOffProduct, nutrientsFor, productFromOff } from '../js/off.js'

const nutella = {
  status: 1,
  product: {
    product_name: 'Nutella',
    brands: 'Ferrero',
    serving_size: '15 g',
    serving_quantity: 15,
    quantity: '400 g',
    nutriments: {
      'energy-kcal_100g': 539,
      proteins_100g: 6.3,
      carbohydrates_100g: 57.5,
      fat_100g: 30.9,
      'energy-kcal_serving': 80.85,
      proteins_serving: 0.945,
      carbohydrates_serving: 8.625,
      fat_serving: 4.635,
    },
  },
}

test('barcode check digits accept real codes and reject a changed digit', () => {
  assert.equal(barcodeKind('3017620422003').kind, 'ean-13')
  assert.equal(barcodeKind('5000159484695').kind, 'ean-13')
  assert.equal(barcodeKind('3017620422004').ok, false)
  assert.equal(barcodeKind(' 3017620422003 ').code, '3017620422003')

  const body = '01234500006'
  const upcA = `${body}${checkDigit(body)}`
  assert.equal(barcodeKind(upcA).kind, 'upc-a')
  const upcE = `0123456${checkDigit(body)}`
  assert.equal(expandUpcE(upcE), upcA)
  assert.equal(isUpcE(upcE), true)

  const ean8Body = '9638507'
  assert.equal(barcodeKind(`${ean8Body}${checkDigit(ean8Body)}`).kind, 'ean-8')
})

test('Open Food Facts JSON becomes per 100 g and per serving nutrients', () => {
  const product = productFromOff('3017620422003', nutella)
  assert.equal(product.name, 'Nutella')
  assert.equal(product.brand, 'Ferrero')
  assert.equal(product.kcalPer100g, 539)
  assert.equal(product.servingQuantity, 15)

  const oneServing = nutrientsFor(product, { mode: 'servings', amount: 1 })
  assert.equal(oneServing.kcal, 81)
  assert.equal(oneServing.proteinG, 0.9)
  assert.equal(oneServing.fatG, 4.6)

  const twoServings = nutrientsFor(product, { mode: 'servings', amount: 2 })
  assert.equal(twoServings.kcal, 162)

  const grams = nutrientsFor(product, { mode: 'grams', amount: 50 })
  assert.equal(grams.kcal, 270)
  assert.equal(grams.carbsG, 28.8)

  const noServing = productFromOff('3017620422003', {
    status: 1,
    product: {
      product_name: 'Plain bar',
      brands: '',
      serving_quantity: '40',
      nutriments: { 'energy-kcal_100g': 250, proteins_100g: 10 },
    },
  })
  assert.equal(nutrientsFor(noServing, { mode: 'servings', amount: 1 }).kcal, 100)
  assert.equal(nutrientsFor(noServing, { mode: 'grams', amount: 0 }).ok, false)
  assert.equal(productFromOff('000', { status: 0 }), null)
  assert.equal(productFromOff('000', { status: 1, product: { product_name: 'Empty' } }), null)
})

test('product lookup uses the injected fetch and does not need the network', async () => {
  let called = ''
  const found = await fetchOffProduct('3017620422003', async (url) => {
    called = url
    return { ok: true, status: 200, json: async () => nutella }
  })
  assert.equal(found.found, true)
  assert.equal(found.product.barcode, '3017620422003')
  assert.match(called, /^https:\/\/world\.openfoodfacts\.org\/api\/v2\/product\/3017620422003\.json/)
  assert.match(called, /product_name/)

  const missing = await fetchOffProduct('3017620422003', async () => ({
    ok: true,
    status: 200,
    json: async () => ({ status: 0 }),
  }))
  assert.equal(missing.found, false)

  await assert.rejects(() => fetchOffProduct('3017620422003', async () => {
    throw new Error('offline')
  }))
})
