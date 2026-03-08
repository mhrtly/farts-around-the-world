import React from 'react'
import {
  EmotionalJourneyWidgetsModule,
  HistoryTimelineModule,
  ScienceFieldGuideModule,
  VintageClippingsModule,
  WordAtlasModule,
} from '../../contentModules/editorial/index.js'
import '../../contentModules/editorial/editorialModules.css'

export default function EditorialAtlasPreview() {
  return (
    <div className="proposal-preview">
      <div className="proposal-scene">
        <header className="proposal-scene__header">
          <div className="proposal-scene__heading">
            <div className="proposal-preview__eyebrow">Draft Proposal 0005</div>
            <h1 className="proposal-preview__title">Editorial Atlas</h1>
            <p className="proposal-preview__lede">
              A reusable content lane for the app: language, science, history, archive texture,
              and emotional-journey widgets. The point is to give Claude real modules he can place
              anywhere, not another giant all-or-nothing mockup.
            </p>
            <div className="proposal-scene__meta">
              <div className="proposal-pill">
                Review note <strong>proposals/0005-editorial-atlas.md</strong>
              </div>
              <div className="proposal-pill">
                Module pack <strong>src/contentModules/editorial/</strong>
              </div>
              <div className="proposal-pill">
                Journey <strong>laugh, wonder, ground, care</strong>
              </div>
            </div>
          </div>

          <div className="proposal-scene__actions">
            <a className="proposal-preview__action" href="/">
              Return to live app
            </a>
          </div>
        </header>

        <div className="editorial-atlas">
          <section className="editorial-atlas__hero">
            <div className="editorial-atlas__hero-title">
              Cabinet Of Winds
            </div>
            <p className="editorial-atlas__hero-copy">
              The user should feel like they have entered a strange and beautiful archive: one
              where laughter opens the door, cultural curiosity keeps them moving, science grounds
              the experience, and the interface never forgets they are a person with feelings.
            </p>
            <div className="editorial-atlas__chips">
              <div className="editorial-atlas__chip">Language shelf</div>
              <div className="editorial-atlas__chip">History trail</div>
              <div className="editorial-atlas__chip">Science field guide</div>
              <div className="editorial-atlas__chip">Archive drawer</div>
              <div className="editorial-atlas__chip">Journey widgets</div>
            </div>
          </section>

          <div className="editorial-atlas__grid">
            <div className="editorial-atlas__stack">
              <EmotionalJourneyWidgetsModule />
              <WordAtlasModule />
            </div>

            <div className="editorial-atlas__stack">
              <HistoryTimelineModule />
              <VintageClippingsModule />
            </div>

            <div className="editorial-atlas__stack">
              <ScienceFieldGuideModule />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
