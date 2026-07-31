import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";
import { Button } from "@heroui/react";
import {
    Bold,
    Heading2,
    Italic,
    Link as LinkIcon,
    List,
    ListOrdered,
    Underline as UnderlineIcon,
} from "lucide-react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import { cn } from "@/lib/utils";
import { isEmailHtmlEmpty, sanitizeEmailHtml } from "@/lib/sanitize-html";

export interface RichTextEditorHandle {
    insertHtml: (html: string) => void;
    focus: () => void;
}

interface RichTextEditorProps {
    value: string;
    onChange: (html: string) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    "aria-label"?: string;
}

const linkProtocols = ["http", "https", "mailto"];

const contentStyles =
    "min-h-[200px] px-3 py-2 text-sm text-foreground outline-none " +
    "[&_p]:my-1 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 " +
    "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1 " +
    "[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1 " +
    "[&_h1]:text-xl [&_h1]:font-semibold [&_h1]:my-2 " +
    "[&_h2]:text-lg [&_h2]:font-semibold [&_h2]:my-2 " +
    "[&_h3]:text-base [&_h3]:font-semibold [&_h3]:my-2 " +
    "[&_a]:text-primary [&_a]:underline [&_strong]:font-semibold [&_em]:italic [&_u]:underline " +
    "[&_img]:my-1 [&_img]:max-h-12 [&_img]:max-w-24 [&_img]:h-auto [&_img]:w-auto [&_img]:align-middle";

const EmailImage = Image.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            width: {
                default: null,
                parseHTML: (element) => element.getAttribute("width"),
                renderHTML: (attributes) =>
                    attributes.width ? { width: attributes.width } : {},
            },
            height: {
                default: null,
                parseHTML: (element) => element.getAttribute("height"),
                renderHTML: (attributes) =>
                    attributes.height ? { height: attributes.height } : {},
            },
            style: {
                default: null,
                parseHTML: (element) => element.getAttribute("style"),
                renderHTML: (attributes) =>
                    attributes.style ? { style: attributes.style } : {},
            },
        };
    },
}).configure({
    inline: true,
    allowBase64: false,
});

export const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(
    function RichTextEditor(
        { value, onChange, placeholder, disabled, className, "aria-label": ariaLabel },
        ref,
    ) {
        const suppressUpdateRef = useRef(false);
        const acceptsEmptyUpdateRef = useRef(false);
        const onChangeRef = useRef(onChange);
        const editorRef = useRef<Editor | null>(null);
        onChangeRef.current = onChange;

        const editor = useEditor({
            extensions: [
                StarterKit.configure({
                    heading: { levels: [1, 2, 3] },
                }),
                Underline,
                EmailImage,
                Link.configure({
                    openOnClick: false,
                    autolink: false,
                    protocols: linkProtocols,
                    HTMLAttributes: {
                        target: "_blank",
                        rel: "noopener noreferrer",
                    },
                }),
            ],
            content: "",
            editable: !disabled,
            editorProps: {
                attributes: {
                    class: contentStyles,
                    role: "textbox",
                    "aria-multiline": "true",
                    ...(ariaLabel ? { "aria-label": ariaLabel } : {}),
                    ...(placeholder ? { "data-placeholder": placeholder } : {}),
                },
                handlePaste: (_view, event) => {
                    const text = event.clipboardData?.getData("text/plain")?.trim() ?? "";
                    if (!/^<img\b[\s\S]*?>$/i.test(text)) return false;
                    const html = sanitizeEmailHtml(text);
                    if (!html.includes("<img")) return false;
                    event.preventDefault();
                    editorRef.current?.chain().focus().insertContent(html).run();
                    return true;
                },
            },
            onUpdate: ({ editor: activeEditor }) => {
                if (suppressUpdateRef.current) return;
                const raw = activeEditor.getHTML();
                const html = sanitizeEmailHtml(raw);
                if (html !== raw) {
                    suppressUpdateRef.current = true;
                    activeEditor.commands.setContent(html, { emitUpdate: false });
                    suppressUpdateRef.current = false;
                }
                if (!acceptsEmptyUpdateRef.current && isEmailHtmlEmpty(html)) return;
                acceptsEmptyUpdateRef.current = true;
                onChangeRef.current(html);
            },
        });

        editorRef.current = editor;

        useImperativeHandle(
            ref,
            () => ({
                insertHtml: (html: string) => {
                    if (!editor) return;
                    const safe = sanitizeEmailHtml(html);
                    if (!safe) return;
                    editor.chain().focus().insertContent(safe).run();
                },
                focus: () => {
                    editor?.commands.focus();
                },
            }),
            [editor],
        );

        useEffect(() => {
            if (!editor) return;
            const next = sanitizeEmailHtml(value || "");
            const current = editor.getHTML();
            if (next === current) return;
            if (next === sanitizeEmailHtml(current) && current === next) return;
            suppressUpdateRef.current = true;
            editor.commands.setContent(next, { emitUpdate: false });
            suppressUpdateRef.current = false;
            acceptsEmptyUpdateRef.current = isEmailHtmlEmpty(next);
        }, [value, editor]);

        useEffect(() => {
            if (!editor) return;
            editor.setEditable(!disabled);
        }, [disabled, editor]);

        if (!editor) return null;

        return (
            <div
                className={cn(
                    "flex flex-col rounded-md border border-border bg-surface-primary",
                    "focus-within:ring-2 focus-within:ring-primary/40 focus-within:border-primary",
                    disabled && "opacity-60 pointer-events-none",
                    className,
                )}
            >
                <Toolbar editor={editor} disabled={disabled} />
                <EditorContent editor={editor} />
            </div>
        );
    },
);

interface ToolbarProps {
    editor: Editor;
    disabled?: boolean;
}

function Toolbar({ editor, disabled }: ToolbarProps) {
    const setLink = () => {
        const previous = editor.getAttributes("link").href as string | undefined;
        const input = window.prompt("URL (leave empty to remove)", previous ?? "https://");
        if (input === null) return;
        const url = input.trim();
        if (url === "") {
            editor.chain().focus().extendMarkRange("link").unsetLink().run();
            return;
        }
        if (!/^(https?:|mailto:)/i.test(url)) {
            window.alert("Only http, https, and mailto links are allowed.");
            return;
        }
        editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    };

    return (
        <div className="flex flex-wrap items-center gap-1 border-b border-border p-1.5">
            <ToolbarButton
                onPress={() => editor.chain().focus().toggleBold().run()}
                isActive={editor.isActive("bold")}
                disabled={disabled}
                label="Bold"
            >
                <Bold className="size-3.5" />
            </ToolbarButton>
            <ToolbarButton
                onPress={() => editor.chain().focus().toggleItalic().run()}
                isActive={editor.isActive("italic")}
                disabled={disabled}
                label="Italic"
            >
                <Italic className="size-3.5" />
            </ToolbarButton>
            <ToolbarButton
                onPress={() => editor.chain().focus().toggleUnderline().run()}
                isActive={editor.isActive("underline")}
                disabled={disabled}
                label="Underline"
            >
                <UnderlineIcon className="size-3.5" />
            </ToolbarButton>
            <span className="mx-1 h-4 w-px bg-border" aria-hidden />
            <ToolbarButton
                onPress={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                isActive={editor.isActive("heading", { level: 2 })}
                disabled={disabled}
                label="Heading 2"
            >
                <Heading2 className="size-3.5" />
            </ToolbarButton>
            <ToolbarButton
                onPress={() => editor.chain().focus().toggleBulletList().run()}
                isActive={editor.isActive("bulletList")}
                disabled={disabled}
                label="Bullet list"
            >
                <List className="size-3.5" />
            </ToolbarButton>
            <ToolbarButton
                onPress={() => editor.chain().focus().toggleOrderedList().run()}
                isActive={editor.isActive("orderedList")}
                disabled={disabled}
                label="Numbered list"
            >
                <ListOrdered className="size-3.5" />
            </ToolbarButton>
            <span className="mx-1 h-4 w-px bg-border" aria-hidden />
            <ToolbarButton
                onPress={setLink}
                isActive={editor.isActive("link")}
                disabled={disabled}
                label="Link"
            >
                <LinkIcon className="size-3.5" />
            </ToolbarButton>
        </div>
    );
}

interface ToolbarButtonProps {
    onPress: () => void;
    isActive?: boolean;
    disabled?: boolean;
    label: string;
    children: React.ReactNode;
}

function ToolbarButton({ onPress, isActive, disabled, label, children }: ToolbarButtonProps) {
    return (
        <Button
            size="sm"
            variant="tertiary"
            isDisabled={disabled}
            onPress={onPress}
            aria-label={label}
            aria-pressed={isActive}
            className={cn(isActive && "bg-surface-secondary text-foreground")}
        >
            {children}
        </Button>
    );
}
