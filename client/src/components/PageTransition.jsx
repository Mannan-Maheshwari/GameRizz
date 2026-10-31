import React, { useRef, useLayoutEffect } from 'react';
import gsap from 'gsap';

export default function PageTransition({ children, transitionKey }) {
  const containerRef = useRef(null);
  const laserBarRef = useRef(null);

  useLayoutEffect(() => {
    if (!containerRef.current) return;

    // Laser bar sweep across the top of the screen
    if (laserBarRef.current) {
      gsap.killTweensOf(laserBarRef.current);
      gsap.fromTo(
        laserBarRef.current,
        { scaleX: 0, opacity: 1, transformOrigin: 'left center' },
        {
          scaleX: 1,
          opacity: 0,
          duration: 0.5,
          ease: 'power2.out',
          onComplete: () => {
            if (laserBarRef.current) {
              gsap.set(laserBarRef.current, { scaleX: 0, opacity: 0 });
            }
          }
        }
      );
    }

    // View content reveal animation
    const ctx = gsap.context(() => {
      gsap.fromTo(
        containerRef.current,
        {
          opacity: 0,
          y: 18,
          scale: 0.985,
          filter: 'blur(6px)'
        },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          filter: 'blur(0px)',
          duration: 0.45,
          ease: 'power3.out'
        }
      );

      // Stagger elements inside the active view for a dynamic cyber entrance
      const staggerTargets = containerRef.current.querySelectorAll(
        '.game-card, .feature-card, .lobby-profile-card, .queue-box, .arena-card, .section-title, .hero-badge'
      );
      if (staggerTargets.length > 0) {
        gsap.fromTo(
          staggerTargets,
          { opacity: 0, y: 15 },
          {
            opacity: 1,
            y: 0,
            duration: 0.4,
            stagger: 0.06,
            ease: 'power2.out',
            delay: 0.08
          }
        );
      }
    }, containerRef);

    return () => ctx.revert();
  }, [transitionKey]);

  return (
    <div className="relative w-full">
      {/* Top Cyber Laser Sweep during transition */}
      <div
        ref={laserBarRef}
        className="fixed top-0 left-0 right-0 h-[3px] pointer-events-none z-50 bg-gradient-to-r from-[#ff007f] via-[#ccff00] to-[#ff007f] shadow-[0_0_12px_#ff007f,0_0_24px_#ccff00]"
        style={{ transform: 'scaleX(0)', opacity: 0 }}
      />
      <div ref={containerRef} className="w-full">
        {children}
      </div>
    </div>
  );
}
