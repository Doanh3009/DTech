import Image from "next/image";
import styles from "./DimixoLogo.module.css";

export const DIMIXO_LOGO="/brand/dimixo-original.png";
export function DimixoLogo({compact=false,className=""}:{compact?:boolean;className?:string}){
 return <span className={`${styles.logo} ${className}`} role="img" aria-label="DIMIXO"><span className={styles.mark}><Image src={DIMIXO_LOGO} alt="" aria-hidden="true" width={1254} height={1254} sizes="160px" priority/></span>{compact?null:<span className={styles.word}><span className={styles.wordmark}><Image src={DIMIXO_LOGO} alt="" aria-hidden="true" width={1254} height={1254} sizes="200px" priority/></span><span className={styles.tagline}>ERP PLATFORM</span></span>}</span>;
}
