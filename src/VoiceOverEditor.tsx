import {ChangeEvent, useRef, useState} from 'react'
import './App.css'

const INITIAL_DATA = [
  {
    id: 0,
    order: 0,
    paragraph_text:
      'Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum.',
  },
  {
    id: 1,
    order: 1,
    paragraph_text:
      'It is a long established fact that a reader will be distracted by the readable content of a page when looking at its layout. The point of using Lorem Ipsum is that it has a more-or-less.',
  },
  {
    id: 2,
    order: 2,
    paragraph_text:
      'Contrary to popular belief, This book is a treatise on the theory of ethics, very popular during the Renaissance. The first line of Lorem Ipsum, "Lorem ipsum dolor sit amet..", comes from a line in section 1.10.32.',
  },
  {
    id: 3,
    order: 3,
    paragraph_text:
      'The standard chunk of Lorem Ipsum used since the 1500s is reproduced below for those interested. Sections 1.10.32 and 1.10.33 from "de Finibus Bonorum et Malorum" by Cicero are also reproduced in their exact original form, accompanied by English versions from the 1914 translation by H. Rackham.',
  },
  {
    id: 4,
    order: 4,
    paragraph_text:
      'There are many variations of passages of Lorem Ipsum available, but the majority have suffered alteration in some form, by injected humour, or randomised words etc..',
  },
]

export default function VoiceOverEditor() {
  const [state, setState] = useState(
    [...INITIAL_DATA]
      .sort((item1, item2) => (item1.order < item2.order ? -1 : 1))
      .map(({id, paragraph_text}) => ({id, paragraph_text})), // Remove `order` field
  )

  const ref = useRef<HTMLTextAreaElement>(null)
  const caretPositionRef = useRef<[number, number]>([0, 0])

  return (
    <textarea
      onSelect={(ev: ChangeEvent<HTMLTextAreaElement>) => {
        caretPositionRef.current = [ev.target.selectionStart, ev.target.selectionEnd]
      }}
      ref={ref}
      onChange={(ev) => {
        let lastGeneratedId: number | undefined
        function generateNewId() {
          if (lastGeneratedId) return ++lastGeneratedId
          return (lastGeneratedId =
            (state.length
              ? state.reduce((itemWithMaxId, item) => (item.id > itemWithMaxId.id ? item : itemWithMaxId)).id
              : 0) + 1)
        }

        // const text = state.reduce((text, item) => text + item.paragraph_text, '')
        const newText = ev.target.value
        const {text, paragraphs} = state.reduce<{
          text: string
          paragraphs: {id: number; text: string; offset: number}[]
        }>(
          ({text, paragraphs}, {id, paragraph_text}, i) => {
            paragraphs.push({
              id,
              text: paragraph_text,
              offset: i ? text.length + 1 : 0,
            })
            return {text: i ? `${text}\n${paragraph_text}` : paragraph_text, paragraphs}
          },
          {text: '', paragraphs: []},
        )
        const {paragraphs: newParagraphs} = newText
          .split('\n')
          .reduce<{paragraphs: {text: string; offset: number}[]; offset: number}>(
            ({paragraphs, offset}, paragraphText) => {
              paragraphs.push({text: paragraphText, offset})
              return {paragraphs, offset: offset + paragraphText.length + 1}
            },
            {paragraphs: [], offset: 0},
          )
        console.debug(paragraphs)
        console.debug(newParagraphs)

        const diff = parseDiff(text, newText, ev.target)
        console.debug('diff', diff)

        const actions: {id: number; type: 'add' | 'delete' | 'modify'; text: string; order: number}[] = []

        if (
          !diff.offset ||
          text[diff.offset - 1] === '\n' ||
          (diff.offset === text.length /* => `!diff.deleted` */ && diff.inserted.startsWith('\n'))
          // || (text[diff.offset] === '\n' && diff.inserted.includes('\n')) // Not happened due to mechanism of our `parseDiff()`
        ) {
          const i = paragraphs.findIndex(({offset}) => offset === diff.offset)
          const noText = !text.length
          const index = noText ? 0 : i === -1 ? paragraphs.length : i

          const deletedParagraphs = diff.deleted.split('\n')
          const deletedCompleteParagraphs = deletedParagraphs.slice(0, -1)
          const deletedParagraphsUpperBound = index + deletedCompleteParagraphs.length
          for (let i = index; i < deletedParagraphsUpperBound; ++i)
            actions.push({type: 'delete', id: paragraphs[i].id, order: i, text: ''})

          const addedParagraphs = diff.inserted.split('\n')
          const addedCompleteParagraphs = addedParagraphs.slice(0, -1)
          const addedParagraphsUpperBound = index + addedCompleteParagraphs.length
          console.debug(paragraphs, {deletedParagraphsUpperBound, index, addedParagraphsUpperBound})
          for (let i = index; i < addedParagraphsUpperBound; ++i)
            actions.push({type: 'add', id: generateNewId(), order: i, text: newParagraphs[i].text})

          if (deletedParagraphs.at(-1) || addedParagraphs.at(-1))
            actions.push({
              type: 'modify',
              id: paragraphs[deletedParagraphsUpperBound]?.id ?? /* maybe `noText` */ 0,
              order: addedParagraphsUpperBound,
              text: newParagraphs[addedParagraphsUpperBound].text,
            })
        } else {
          const i = paragraphs.findIndex(({offset}) => offset > diff.offset)
          const index = i === -1 ? paragraphs.length - 1 /* `paragraphs.length > 0`  */ : i - 1
          actions.push({
            type: 'modify',
            id: paragraphs[index].id,
            order: index,
            text: newParagraphs[index].text,
          })

          const deletedParagraphs = diff.deleted.split('\n')
          const deletedCompleteParagraphs = deletedParagraphs.slice(1)
          const deletedParagraphsUpperBound = index + 1 + deletedCompleteParagraphs.length
          for (let i = index + 1; i < deletedParagraphsUpperBound; ++i)
            actions.push({type: 'delete', id: paragraphs[i].id, order: i, text: ''})

          const addedParagraphs = diff.inserted.split('\n')
          const addedCompleteParagraphs = addedParagraphs.slice(1)
          const addedParagraphsUpperBound = index + 1 + addedCompleteParagraphs.length
          for (let i = index + 1; i < addedParagraphsUpperBound; ++i)
            actions.push({type: 'add', id: generateNewId(), order: i, text: newParagraphs[i].text})
        }

        console.info('%cActions:%o', 'font-weight: bold', ...actions)

        // Use `toSpliced()` when widely available in all browsers: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/toSpliced#browser_compatibility
        const newState = [...state]
        for (const action of actions)
          newState.splice(
            ...([
              action.type === 'add' ? action.order : newState.findIndex(({id}) => id === action.id),
              action.type === 'add' ? 0 : 1,
              action.type === 'delete'
                ? (undefined as unknown as {id: number; paragraph_text: string}) // Don't care the cast. It will be filtered out.
                : {id: action.id, paragraph_text: action.text},
              // Use `toSpliced()` to filter the last arg instead of `filter()` when `toSpliced()` was widely available in all browsers: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/toSpliced#browser_compatibility
            ].filter((arg) => arg !== undefined) as [number, 0 | 1]),
          )

        const reconstructedNewText = newState.reduce(
          (newText, {paragraph_text}, i) => (i ? `${newText}\n${paragraph_text}` : paragraph_text),
          '',
        )
        console.assert(
          newText === reconstructedNewText,
          '\nnewText:',
          newText,
          '\n\nreconstructedNewText:',
          reconstructedNewText,
        )
        setState(newState)
      }}
      defaultValue={state.map(({paragraph_text}) => paragraph_text).join('\n')}
      rows={30}
      style={{width: 700}}
    />
  )
}

function parseDiff(
  text0: string,
  text: string,
  {selectionStart, selectionEnd}: {selectionStart: number; selectionEnd: number},
): {deleted: string; inserted: string; offset: number; eventType: 'ADD' | 'DELETE' | 'REPLACE' | 'NOTHING'} {
  let i = 0
  for (; i < selectionStart; ++i) if (text[i] !== text0[i]) break
  const offset = i

  i = text.length
  let j = text0.length
  for (; i > selectionEnd && j > offset; --i, --j)
    if (text[i] /* maybe `undefined` */ !== text0[j] /* maybe `undefined` */) break
  console.debug({i, j, offset})
  const inserted = text.slice(offset, i)
  const deleted = text0.slice(offset, j)
  const eventType = inserted ? (deleted ? 'REPLACE' : 'ADD') : deleted ? 'DELETE' : 'NOTHING'

  console.assert(text0.slice(offset + deleted.length) === text.slice(offset + inserted.length))

  return {inserted, deleted, offset, eventType}
}
