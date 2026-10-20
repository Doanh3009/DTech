import styles from "./LoginBackdrop.module.css";
import { constructionIllustrations } from "./ConstructionIllustrations";

export function LoginBackdrop() {
  return <div aria-hidden="true" className={styles.scene} data-construction-background>
    <svg className={styles.washes} fill="none" focusable="false" preserveAspectRatio="none" viewBox="0 0 1920 1080">
      <path className={styles.mintWash} d="M0 0h684C568 179 389 331 196 358 114 371 42 372 0 357V0Z" />
      <path className={styles.mintRibbon} d="M0 262c137 17 176 71 306 10C507 177 558 52 660 0h88C615 99 540 293 328 373 205 420 86 420 0 399V262Z" />
      <path className={styles.blueWash} d="M1920 0h-304c-212 122-211 261-369 317-176 62-338 70-419 149 142 66 362 72 545 13 210-68 278-258 547-251V0Z" />
      <path className={styles.blueRibbon} d="M1920 411c-207-76-363 60-466 157-129 122-170 253-296 309 177 34 277-34 392-131 123-104 241-151 370-103V411Z" />
      <path className={styles.beigeWash} d="M0 592c228-44 379 72 535 206 119 102 225 130 351 116 186-20 343-116 511-68 118 34 187 105 277 234H0V592Z" />
      <path className={styles.beigeRibbon} d="M0 734c247-80 418 115 632 168 157 39 279-37 427-29 201 11 298 174 505 207h-328c-181-82-266-87-387-54-210 57-366-78-560-124C156 870 76 883 0 911V734Z" />
    </svg>
    {constructionIllustrations.map(({ kind, viewBox, drawing }) => <div
      className={[styles.traveler, styles[kind]].join(" ")}
      data-construction-traveler={kind}
      key={kind}
    ><svg
      className={[styles.icon, styles[kind]].join(" ")}
      data-construction-icon={kind}
      fill="none"
      focusable="false"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.3"
      viewBox={viewBox}
    >{drawing}</svg></div>)}
  </div>;
}
