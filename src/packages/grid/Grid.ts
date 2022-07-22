import { GridField, GridPosition } from "./types/GridTypes";

// gets a grid position from x and y pixel values
export function getGridPosFromPos(xPos: number, yPos: number): { column: number; row: number } {
   const fieldContainer = document.getElementById("fields-container") as HTMLElement;
   const fieldContainerRect = fieldContainer.getBoundingClientRect();

   // add 10 to field container width to account for the column gap (5 on either side)
   const columnSize = (fieldContainerRect.width + 10) / 8;
   // minimum value is 1 (in case xPos is 0)
   const column = Math.floor(xPos / columnSize + 1);

   const rowSize = (fieldContainerRect.height + 10) / 8;
   const row = Math.floor(yPos / rowSize + 1);

   return { column: column, row: row };
}

// gets the grid position of the mouse based on whether its in the middle of a grid position or not
export function getAdjustedGridPosFromMousePos(
   e: React.MouseEvent<HTMLDivElement, MouseEvent>,
   grabbedPos: { column: number; row: number }
): {
   column: number;
   row: number;
} {
   const fieldContainerRect = (document.getElementById("fields-container") as HTMLElement).getBoundingClientRect();

   const offsetPageX = e.pageX - fieldContainerRect.left + 5;
   const offsetPageY = e.pageY - fieldContainerRect.top + 5;

   // get column
   const columnSize = (fieldContainerRect.width + 10) / 8;
   const columnPos = offsetPageX / columnSize + 1; // e.g 2.456

   // get row
   const rowSize = (fieldContainerRect.height + 10) / 8;
   const rowPos = offsetPageY / rowSize + 1;

   const prevGridPos = grabbedPos;

   let newColumn = prevGridPos.column;
   let newRow = prevGridPos.row;
   if (prevGridPos.column !== Math.floor(columnPos) || prevGridPos.row !== Math.floor(rowPos)) {
      const resizeThreshold = 0.15;
      const relativeColumnPosRatio = columnPos - Math.floor(columnPos); // e.g 0.456
      if (
         (prevGridPos.column < columnPos && relativeColumnPosRatio >= resizeThreshold) ||
         (prevGridPos.column > columnPos && relativeColumnPosRatio <= 1 - resizeThreshold)
      ) {
         newColumn = Math.floor(columnPos);
      }

      const relativeRowPosRatio = rowPos - Math.floor(rowPos); // 0.456
      if (
         (prevGridPos.row < rowPos && relativeRowPosRatio >= resizeThreshold) ||
         (prevGridPos.row > rowPos && relativeRowPosRatio <= 1 - resizeThreshold)
      ) {
         newRow = Math.floor(rowPos);
      }
   }

   return { column: newColumn, row: newRow };
}

// gets a grid position based on the position of a field
export function getGridPosFromFieldPos(field: HTMLElement): GridPosition {
   const fieldContainerRect = field.parentElement!.getBoundingClientRect();
   const fieldRect = field.getBoundingClientRect();

   // get the grid pos of the start and end of a grid item
   const columnRowStart = getGridPosFromPos(
      fieldRect.left - fieldContainerRect.left + 10,
      fieldRect.top - fieldContainerRect.top + 10
   );
   const columnRowEnd = getGridPosFromPos(
      fieldRect.right - fieldContainerRect.left - 10,
      fieldRect.bottom - fieldContainerRect.top - 10
   );

   return {
      column: { start: columnRowStart.column, end: columnRowEnd.column },
      row: { start: columnRowStart.row, end: columnRowEnd.row },
   };
}

// returns a grid of the specified size with each position initialised with -1
export function getNewGridOfSize(width: number, height: number): number[][] {
   let newGrid: number[][] = [];
   for (let y = 0; y < height; y++) {
      if (!newGrid[y]) {
         newGrid[y] = [];
      }
      for (let x = 0; x < width; x++) {
         if (!newGrid[y][x]) {
            newGrid[y][x] = -1;
         }
      }
   }
   return newGrid;
}

// finds a position for a field to fit into a grid based on where other fields are positioned
// should change this to find what the newly moved field is colliding with (if any) then recursively moved every field affected by the move
export function getEmptyGridSpace(grid: number[][], fieldWidth: number, fieldHeight: number): GridPosition | null {
   let pos = { column: { start: -1, end: -1 }, row: { start: -1, end: -1 } };

   const rowAmount = 30;
   for (let y = 0; y < rowAmount; y++) {
      for (let x = 0; x < grid[0].length; x++) {
         if (grid[y][x] === -1) {
            if (pos.column.start === -1) {
               if (grid[y].length - x >= fieldWidth && rowAmount - y >= fieldHeight) {
                  pos.column.start = x;
                  pos.row.start = y;
               } else {
                  break;
               }
            }
            if (x - pos.column.start + 1 === fieldWidth) {
               pos.column.end = x;
               for (let xx = pos.column.start; xx <= pos.column.end; xx++) {
                  let isEmpty = true;
                  for (let yy = pos.row.start; yy - pos.row.start < fieldHeight && yy < grid.length; yy++) {
                     if (grid[yy][xx] !== -1) {
                        isEmpty = false;

                        pos.column.start = -1;
                        pos.column.end = -1;
                        pos.row.start = -1;
                        pos.row.end = -1;

                        x = pos.column.start; // set x to column.start to see if it can be placed starting on the next column (the for loop will add 1)
                        break;
                     } else {
                        if (xx === pos.column.end && yy - pos.row.start + 1 === fieldHeight) {
                           pos.row.end = yy;
                           return pos;
                        }
                     }
                  }
                  if (!isEmpty) break;
               }
            }
         } else if (pos.column.start !== -1) {
            pos.column.start = -1;
            pos.column.end = -1;
            pos.row.start = -1;
            pos.row.end = -1;
         }
      }
   }
   return null;
}

// propagates the changes from a resized field. returns null if the propagation has finished
export function getOverlappingFields(grid: GridField[], overlappingFields: GridField[]): GridField[] | null {
   let newOverlappingFields: GridField[] = [];
   for (let f = 0; f < overlappingFields.length; f++) {
      const field = overlappingFields[f];
      for (let i = 0; i < grid.length; i++) {
         if (grid[i].index === field.index) {
            grid[i] = field;
            continue;
         }
         // if the field being checked has overlapped grid[i]
         if (fieldsAreOverlapping(grid[i], field)) {
            newOverlappingFields.push(grid[i]);
         }
      }
   }
   return newOverlappingFields.length > 0 ? newOverlappingFields : null;
}

// checks if two fields are overlapping
export function fieldsAreOverlapping(fieldOne: GridField, fieldTwo: GridField): boolean {
   let curFieldOne = fieldOne;
   let curFieldTwo = fieldTwo;
   // check both positions
   for (let i = 1; i <= 2; i++) {
      if (
         curFieldOne.topLeftPos.column > curFieldTwo.bottomRightPos.column ||
         curFieldOne.bottomRightPos.column < curFieldTwo.topLeftPos.column
      ) {
         curFieldOne = fieldTwo;
         curFieldTwo = fieldOne;
      } else {
         return true;
      }
   }
   return false;
}

// gets the indexes in a grid in order from top left to bottom right position
export function getFieldsInOrder(grid: number[][]): number[] {
   let indexes: number[] = [];
   for (let y = 0; y < grid.length; y++) {
      for (let x = 0; x < grid[0].length; x++) {
         if (grid[y][x] !== -1 && !indexes.includes(grid[y][x])) {
            indexes.push(grid[y][x]);
         }
      }
   }
   return indexes;
}

// adds a field (index) to a grid
export function addFieldToGrid(grid: number[][], index: number, pos: GridPosition) {
   for (let y = pos.row.start; y <= pos.row.end; y++) {
      for (let x = pos.column.start; x <= pos.column.end; x++) {
         grid[y][x] = index;
      }
   }
}

// switches the position of two indexes
export function switchFieldPositions(grid: number[][], indexOne: number, indexTwo: number) {
   for (let y = 0; y < grid.length; y++) {
      for (let x = 0; x < grid[y].length; x++) {
         if (grid[y][x] === indexOne) {
            grid[y][x] = indexTwo;
         } else if (grid[y][x] === indexTwo) {
            grid[y][x] = indexOne;
         }
      }
   }
}

// initialises the grid with each field
export function initialiseGridWithFields(grid: number[][], fieldAmount: number): number[][] {
   let newGrid = [...grid];
   for (let i = 0; i < fieldAmount; i++) {
      let found = false;
      for (let y = 0; y < newGrid.length; y++) {
         for (let x = 0; x < newGrid[0].length; x++) {
            if (newGrid[y][x] === -1) {
               newGrid[y][x] = i;
               found = true;
               break;
            }
         }
         if (found) break;
      }
   }
   return newGrid;
}

// displays a grid as text to the console
export function displayGrid(grid: number[][]) {
   let gridText = "";
   for (let y = 0; y < grid.length; y++) {
      if (grid[y][0] !== -1) {
         for (let x = 0; x < grid[0].length; x++) {
            gridText += grid[y][x] + 1;
            if (x !== grid.length) {
               gridText += " ";
            }
         }
         gridText += "\n";
      } else {
         break;
      }
   }
   console.log(gridText);
}
