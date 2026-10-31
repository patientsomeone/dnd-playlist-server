import type {ButtonHTMLAttributes} from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {label: string; icon: "add" | "remove" | "swap" | "favorite" | "play" | "pause"; indicator?: "swap";};

export function IconButton({label, icon, indicator, title = label, className = "", ...props}: Props) {
    return <button {...props} type="button" className={"icon-button " + className} aria-label={label} title={title} data-icon={icon} data-indicator={indicator}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
            {icon === "add" && <path d="M12 5v14M5 12h14"/>}
            {icon === "remove" && <path d="M5 12h14"/>}
            {icon === "swap" && <path d="m4 7 4-4 4 4M8 3v16m4-2 4 4 4-4M16 21V5"/>}
            {icon === "favorite" && <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>}
            {icon === "play" && <path d="m8 5 11 7-11 7Z"/>}
            {icon === "pause" && <path d="M8 5v14M16 5v14"/>}
        </svg>
        {indicator === "swap" && <svg className="icon-indicator" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
            <path d="M3 7h17m-4-4 4 4-4 4M21 17H4m4-4-4 4 4 4"/>
        </svg>}
    </button>;
}
