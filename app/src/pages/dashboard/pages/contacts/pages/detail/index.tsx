import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Routes } from "@/routes/routes";
import { ContactDetailView } from "./components";

export default function ContactDetailPage() {
    const { uuid = "" } = useParams<{ uuid: string }>();
    const [searchParams] = useSearchParams();
    const listUuid = searchParams.get("list_uuid") ?? undefined;
    const navigate = useNavigate();

    return (
        <ContactDetailView
            contactUuid={uuid}
            listUuid={listUuid}
            onBack={() => navigate(-1)}
            onDeleted={() => navigate(Routes.dashboard.contacts)}
        />
    );
}
