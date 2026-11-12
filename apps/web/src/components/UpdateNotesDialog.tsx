import React from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";
// the patch note is a plain file at the repository root: edit that file, this window follows
import notesText from "../../../../uiux-update-listup.md?raw";

interface Section {
  title: string;
  lines: string[];
}

export interface Notes {
  /** sentences written under the "#" title, before the first "##" section */
  intro: string[];
  sections: Section[];
}

/**
 * "# title" is the window title, other text before the first "##" is the intro,
 * "## title" starts a section, "- text" is one line of it. Everything else is ignored.
 */
export const parseNotes = (text: string): Notes => {
  const notes: Notes = { intro: [], sections: [] };
  text
    .replace(/<!--[\s\S]*?-->/g, "")
    .split(/\r?\n/)
    .forEach((raw) => {
      const line = raw.trim();
      const heading = /^##\s+(.+)$/.exec(line);
      const item = /^-\s+(.+)$/.exec(line);
      if (heading) notes.sections.push({ title: heading[1].trim(), lines: [] });
      else if (item && notes.sections.length > 0) {
        notes.sections[notes.sections.length - 1].lines.push(item[1].trim());
      } else if (line !== "" && !line.startsWith("#") && notes.sections.length === 0) {
        notes.intro.push(line);
      }
    });
  return notes;
};

// **bold** pieces of an intro sentence
const withBold = (line: string) =>
  line
    .split(/(\*\*[^*]+\*\*)/g)
    .map((part, index) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={index}>{part.slice(2, -2)}</strong>
      ) : (
        part
      )
    );

interface Props {
  open: boolean;
  onClose: () => void;
}

/** "Note": what changed on the screens, one line each. */
const UpdateNotesDialog: React.FC<Props> = ({ open, onClose }) => {
  const { intro, sections } = React.useMemo(() => parseNotes(notesText), []);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      scroll="paper"
      PaperProps={{ "data-testid": "uiux-notes-dialog" } as object}
    >
      <DialogTitle>UI/UX 업데이트 노트</DialogTitle>
      <DialogContent dividers>
        {intro.map((line) => (
          <Typography
            key={line}
            variant="body2"
            sx={{ marginBottom: 2 }}
            data-testid="uiux-notes-intro"
          >
            {withBold(line)}
          </Typography>
        ))}
        {sections.map((section) => (
          <Box key={section.title} sx={{ marginBottom: 2 }} data-testid="uiux-notes-section">
            <Typography variant="subtitle2" color="primary" sx={{ fontWeight: 700 }}>
              {section.title}
            </Typography>
            <Box component="ul" sx={{ margin: "4px 0 0", paddingLeft: 3 }}>
              {section.lines.map((line) => (
                <Typography
                  key={line}
                  component="li"
                  variant="body2"
                  sx={{ marginBottom: 0.5 }}
                  data-testid="uiux-notes-line"
                >
                  {line}
                </Typography>
              ))}
            </Box>
          </Box>
        ))}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} data-testid="uiux-notes-close">
          닫기
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default UpdateNotesDialog;
