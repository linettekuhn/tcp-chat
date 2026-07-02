import { ActionIcon, CopyButton, Tooltip } from "@mantine/core";
import { MdCheck, MdOutlineCopyAll } from "react-icons/md";

export default function CustomCopyButton({
  value,
  valueName,
}: {
  value: string;
  valueName: string;
}) {
  return (
    <CopyButton value={value}>
      {({ copied, copy }) => (
        <Tooltip
          label={copied ? "Copied" : `Copy ${valueName}`}
          position="top"
          withArrow
        >
          <ActionIcon
            color={copied ? "teal" : "dimmed"}
            variant="subtle"
            onClick={copy}
            size="sm"
          >
            {copied ? <MdCheck size={14} /> : <MdOutlineCopyAll size={14} />}
          </ActionIcon>
        </Tooltip>
      )}
    </CopyButton>
  );
}
