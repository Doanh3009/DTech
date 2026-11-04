import {notFound} from "next/navigation";
import {DropdownPreview} from "./preview";
export default function Page(){if(process.env.NODE_ENV==="production")notFound();return <DropdownPreview/>;}
