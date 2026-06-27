import { useState } from "react";
import { ActionIcon, Tooltip } from "@mantine/core";
import { MdCheck, MdContentPaste } from "react-icons/md";
import { toast } from "react-toastify";

export default function CustomPasteButton({
  onPaste,
  valueName,
}: {
  onPaste: (value: string) => void;
  valueName: string;
}) {
  const [justPasted, setJustPasted] = useState(false);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      onPaste(text);
      setJustPasted(true);
      setTimeout(() => setJustPasted(false), 1500);
    } catch {
      toast.warn("Failed to paste");
    }
  };

  return (
    <Tooltip
      label={justPasted ? "Pasted!" : `Paste ${valueName}`}
      position="top"
      withArrow
    >
      <ActionIcon
        color={justPasted ? "teal" : "dimmed"}
        variant="subtle"
        onClick={handlePaste}
        size="sm"
      >
        {justPasted ? <MdCheck size={14} /> : <MdContentPaste size={14} />}
      </ActionIcon>
    </Tooltip>
  );
}
