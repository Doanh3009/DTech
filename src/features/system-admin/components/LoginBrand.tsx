import Image from "next/image";

import { OFFICIAL_APP_LOGO } from "@/components/layout/AppLogo";

export function LoginBrand({ shortName }: { shortName: string }) {
  return <Image
    alt={`Logo ${shortName}`}
    className="login-brand__image login-brand__image--official-full"
    height={559}
    loading="eager"
    src={OFFICIAL_APP_LOGO}
    unoptimized
    width={447}
  />;
}
