import React from "react";
import { Box, Typography, Grid, colors } from "@mui/material";

const { grey } = colors;

const EmptyList: React.FC<{ entity: string; children?: React.ReactNode }> = ({
  entity,
  children,
}) => {
  return (
    <Box
      display="flex"
      height={600}
      min-height={600}
      alignItems="center"
      justifyContent="center"
      border={1}
      borderColor={grey[200]}
      sx={{
        "@media (max-width: 599.95px)": {
          "& .MuiGrid-item": { maxWidth: "100%", minWidth: 0 },
          "& svg": { maxWidth: "100%", height: "auto !important" },
          "& h2": { fontSize: 16, textAlign: "center", overflowWrap: "anywhere" },
        },
      }}
    >
      <Grid
        container
        direction="column"
        justifyContent="center"
        alignItems="center"
        style={{ height: "100%", width: "100%" }}
        spacing={2}
      >
        <Grid item data-testid="empty-list-header">
          <Typography component="h2" variant="h6" color="primary" gutterBottom>
            {entity} 내역이 없습니다
          </Typography>
        </Grid>
        <Grid item>
          <Box
            data-testid="empty-list-children"
            display="flex"
            width={300}
            sx={{ maxWidth: "100%" }}
            alignItems="center"
            justifyContent="center"
          >
            {children}
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default EmptyList;
