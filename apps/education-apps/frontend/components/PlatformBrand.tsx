// The platform name in the login/signup headers: the default name keeps its two-tone styling.
export default function PlatformBrand({ name, accentClass }: { name: string; accentClass: string }) {
    if (name === 'ArwaEduc') {
        return (
            <>
                Arwa<span className={accentClass}>Educ</span>
            </>
        );
    }
    return <>{name}</>;
}
