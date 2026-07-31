import { SourceType } from "@/features/leads/interfaces/lead.interface";
import { Suspense, lazy } from "react";
import { ManualQuerySection } from "./manual-key-value-editor";
import { QueryConfigFieldsSkeleton } from "./query-config-fields-skeleton";
import type { FilterQueryFieldsProps } from "./types";

const LinkedInQueryFields = lazy(() =>
    import("./linkedin-query-fields").then((m) => ({ default: m.LinkedInQueryFields })),
);
const GoogleMapsQueryFields = lazy(() =>
    import("./google-maps-query-fields").then((m) => ({ default: m.GoogleMapsQueryFields })),
);
const GenericLeadQueryFields = lazy(() =>
    import("./generic-lead-query-fields").then((m) => ({ default: m.GenericLeadQueryFields })),
);
const GemiQueryFields = lazy(() =>
    import("./gemi-query-fields").then((m) => ({ default: m.GemiQueryFields })),
);

export function QueryConfigFields(props: FilterQueryFieldsProps) {
    const { sourceType } = props;
    if (sourceType === SourceType.LINKEDIN) {
        return (
            <Suspense fallback={<QueryConfigFieldsSkeleton />}>
                <LinkedInQueryFields {...props} />
            </Suspense>
        );
    }
    if (sourceType === SourceType.GOOGLE_MAPS) {
        return (
            <Suspense fallback={<QueryConfigFieldsSkeleton />}>
                <GoogleMapsQueryFields {...props} />
            </Suspense>
        );
    }
    if (sourceType === SourceType.GENERIC_LEAD) {
        return (
            <Suspense fallback={<QueryConfigFieldsSkeleton />}>
                <GenericLeadQueryFields {...props} />
            </Suspense>
        );
    }
    if (sourceType === SourceType.GEMI) {
        return (
            <Suspense fallback={<QueryConfigFieldsSkeleton />}>
                <GemiQueryFields {...props} />
            </Suspense>
        );
    }
    return <ManualQuerySection control={props.control} />;
}
