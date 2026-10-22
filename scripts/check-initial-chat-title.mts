import assert from 'node:assert/strict'
import { deriveInitialChatTitle } from '../src/lib/chatTitle.ts'

const cases: Array<[string, string]> = [
  ['How do I see rows?', 'How do I see rows?'],
  ['Select all from user', 'Select all from user'],
  ['How do I list tables?', 'How do I list tab...'],
  ['How do I\njoin tables?', 'How do I join tab...'],
  ['   ', ''],
  ['  Show   all\ncustomers  ', 'Show all customers'],
]

for (const [input, expected] of cases) {
  assert.equal(deriveInitialChatTitle(input), expected)
}

const longResults = [
  deriveInitialChatTitle('How do I list tables?'),
  deriveInitialChatTitle('How do I\njoin tables?'),
]
for (const title of longResults) {
  assert.equal(title.length, 20)
  assert.ok(title.endsWith('...'))
}

const longTitle = deriveInitialChatTitle('How do I list tables?')
assert.equal(deriveInitialChatTitle(longTitle), longTitle)

console.log('ok')
