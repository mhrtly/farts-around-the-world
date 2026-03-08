import React from 'react'
import {
  emotionalJourneyWidgets,
  fartLexiconEntries,
  historyTimeline,
  scienceCaution,
  scienceFactCards,
  vintageClippings,
} from './editorialData.js'

function EditorialFrame({ eyebrow, title, subtitle, children, className = '' }) {
  const classes = ['editorial-module', className].filter(Boolean).join(' ')

  return (
    <section className={classes}>
      <div className="editorial-module__header">
        <div className="editorial-module__eyebrow">{eyebrow}</div>
        <h2 className="editorial-module__title">{title}</h2>
        {subtitle ? <p className="editorial-module__subtitle">{subtitle}</p> : null}
      </div>
      <div className="editorial-module__body">{children}</div>
    </section>
  )
}

function SourceLink({ source }) {
  return (
    <a
      className="editorial-source"
      href={source.url}
      target="_blank"
      rel="noreferrer"
    >
      {source.label}
    </a>
  )
}

export function WordAtlasModule({
  items = fartLexiconEntries,
  title = 'The Word Around The World',
}) {
  return (
    <EditorialFrame
      eyebrow="Language Shelf"
      title={title}
      subtitle="A curated lexicon wall. Terms vary by region and register, which is part of the fun."
    >
      <div className="editorial-lexicon">
        {items.map((entry) => (
          <article key={entry.language} className="editorial-lexicon__card">
            <div className="editorial-lexicon__topline">
              <span className="editorial-lexicon__language">{entry.language}</span>
              <span className="editorial-lexicon__region">{entry.region}</span>
            </div>
            <div className="editorial-lexicon__term">{entry.term}</div>
            <div className="editorial-lexicon__transliteration">{entry.transliteration}</div>
            <p className="editorial-lexicon__note">{entry.note}</p>
            <SourceLink source={entry.source} />
          </article>
        ))}
      </div>
    </EditorialFrame>
  )
}

export function ScienceFieldGuideModule({
  items = scienceFactCards,
  caution = scienceCaution,
}) {
  return (
    <EditorialFrame
      eyebrow="Science Field Guide"
      title="Flatulence, Without The Fake Mysticism"
      subtitle="A grounding module for when the user needs one layer of reality under the joke."
    >
      <div className="editorial-science">
        {items.map((item) => (
          <article key={item.title} className={`editorial-science__card editorial-science__card--${item.tone}`}>
            <div className="editorial-science__title">{item.title}</div>
            <p className="editorial-science__body">{item.body}</p>
            <SourceLink source={item.source} />
          </article>
        ))}
      </div>

      <div className="editorial-caution">
        <div className="editorial-caution__title">{caution.title}</div>
        <p className="editorial-caution__body">{caution.body}</p>
        <SourceLink source={caution.source} />
      </div>
    </EditorialFrame>
  )
}

export function HistoryTimelineModule({ items = historyTimeline }) {
  return (
    <EditorialFrame
      eyebrow="History Trail"
      title="Farts Throughout History"
      subtitle="A fast route from antiquity to newspapers, built to make the user feel they just entered a bizarre global museum."
    >
      <div className="editorial-timeline">
        {items.map((item) => (
          <article key={`${item.year}-${item.title}`} className="editorial-timeline__item">
            <div className="editorial-timeline__rail" />
            <div className="editorial-timeline__year">{item.year}</div>
            <div className="editorial-timeline__content">
              <div className="editorial-timeline__title">{item.title}</div>
              <p className="editorial-timeline__detail">{item.detail}</p>
              <SourceLink source={item.source} />
            </div>
          </article>
        ))}
      </div>
    </EditorialFrame>
  )
}

export function VintageClippingsModule({ items = vintageClippings }) {
  return (
    <EditorialFrame
      eyebrow="Archive Drawer"
      title="Vintage Flatulence Clippings"
      subtitle="These old newspaper items are interesting precisely because medicine, advertising, embarrassment, and showmanship all blur together."
    >
      <div className="editorial-clippings">
        {items.map((item) => (
          <article key={`${item.year}-${item.headline}`} className="editorial-clippings__card">
            <div className="editorial-clippings__topline">
              <span className="editorial-clippings__year">{item.year}</span>
              <span className="editorial-clippings__outlet">{item.outlet}</span>
            </div>
            <div className="editorial-clippings__headline">{item.headline}</div>
            <p className="editorial-clippings__summary">{item.summary}</p>
            <SourceLink source={item.source} />
          </article>
        ))}
      </div>
    </EditorialFrame>
  )
}

export function EmotionalJourneyWidgetsModule({ items = emotionalJourneyWidgets }) {
  return (
    <EditorialFrame
      eyebrow="Journey Widgets"
      title="Build For Feelings, Not Just Features"
      subtitle="Small modules that can guide the user from embarrassment to delight, then into curiosity and optional care."
    >
      <div className="editorial-widgets">
        {items.map((item) => (
          <article key={item.title} className="editorial-widget">
            <div className="editorial-widget__topline">
              <span className="editorial-widget__title">{item.title}</span>
              <span className="editorial-widget__feeling">{item.feeling}</span>
            </div>
            <p className="editorial-widget__body">{item.body}</p>
            <div className="editorial-widget__action">{item.action}</div>
          </article>
        ))}
      </div>
    </EditorialFrame>
  )
}
