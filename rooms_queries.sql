use ClassNoteDB;
select * from rooms_players;
select * from rooms_rooms;

SET @x = 0;
SET @y = 0;

DROP PROCEDURE go;

delimiter #
CREATE PROCEDURE go()
BEGIN
WHILE @x < 30 DO
    WHILE @y < 30 DO
        INSERT INTO rooms_doors (room_x, room_y, direction) VALUES (@x, @y, "left");
        INSERT INTO rooms_doors (room_x, room_y, direction) VALUES (@x, @y, "right");
        INSERT INTO rooms_doors (room_x, room_y, direction) VALUES (@x, @y, "up");
        INSERT INTO rooms_doors (room_x, room_y, direction) VALUES (@x, @y, "down");
        SET @y = @y + 1;
	END WHILE;
    
    SET @y = 0;
    SET @x = @x + 1;
END WHILE;
END #

call go();

SELECT * FROM rooms_rooms;
SELECT * FROM rooms_doors;


