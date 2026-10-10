import { motion, type Variants } from 'motion/react';
import { Link } from 'react-router-dom';
import HlsVideo from './HlsVideo';
import type { SlideContent } from './slides';

const content: Variants = {
  hidden: { transition: { staggerChildren: 0.03, staggerDirection: -1 } },
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.15 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

interface SlideProps {
  slide: SlideContent;
  index: number;
  total: number;
  isActive: boolean;
}

export function Slide({ slide, index, total, isActive }: SlideProps) {
  return (
    <motion.section
      className="absolute inset-0 bg-black"
      initial={false}
      animate={{ opacity: isActive ? 1 : 0 }}
      transition={{ duration: 0.35, ease: 'easeInOut' }}
      style={{ zIndex: isActive ? 10 : 0, pointerEvents: isActive ? 'auto' : 'none' }}
      aria-roledescription="slide"
      aria-label={`${index + 1} of ${total}: ${slide.title}`}
      aria-hidden={!isActive}
      // Keeps hidden slides' links and buttons out of the tab order
      inert={!isActive}
    >
      <div className="absolute inset-0" style={{ background: slide.gradient }} />
      {slide.playbackId && (
        <HlsVideo playbackId={slide.playbackId} active={isActive} className="absolute inset-0 h-full w-full object-cover" />
      )}
      {/* Scrim keeps text legible over any footage */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/10" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-transparent to-transparent" />

      <motion.div
        className="relative flex h-full flex-col justify-end px-6 pb-24 sm:px-12 md:px-20 md:pb-28"
        variants={content}
        initial="hidden"
        animate={isActive ? 'visible' : 'hidden'}
      >
        <div className="max-w-3xl">
          <motion.p variants={item} className="mb-4 text-xs font-medium uppercase tracking-[0.25em] text-white/60">
            {slide.eyebrow}
          </motion.p>
          <motion.h2
            variants={item}
            className="text-4xl font-medium leading-[1.05] tracking-tight text-white sm:text-5xl md:text-7xl"
          >
            {slide.title}
          </motion.h2>
          <motion.p variants={item} className="mt-6 max-w-xl text-base leading-relaxed text-white/70 md:text-lg">
            {slide.body}
          </motion.p>

          {slide.points && (
            <motion.ul variants={item} className="mt-8 flex flex-wrap gap-2">
              {slide.points.map((point) => (
                <li
                  key={point}
                  className="rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs text-white/80 backdrop-blur-sm"
                >
                  {point}
                </li>
              ))}
            </motion.ul>
          )}

          {slide.cta && (
            <motion.div variants={item} className="mt-10">
              <Link
                to={slide.cta.to}
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition-colors hover:bg-white/85 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              >
                {slide.cta.label}
                <span aria-hidden="true">→</span>
              </Link>
            </motion.div>
          )}
        </div>
      </motion.div>
    </motion.section>
  );
}

export default Slide;
