-- Seed Music Trivia Questions
-- These are initial questions to get the game started

INSERT INTO trivia_questions (category, difficulty, question, correct_answer, incorrect_answers) VALUES
-- Easy Questions
('music', 'easy', 'Which band performed the song "Bohemian Rhapsody"?', 'Queen', ARRAY['The Beatles', 'Led Zeppelin', 'Pink Floyd']),
('music', 'easy', 'Who is known as the "King of Pop"?', 'Michael Jackson', ARRAY['Elvis Presley', 'Prince', 'James Brown']),
('music', 'easy', 'Which instrument does Jimi Hendrix famously play?', 'Electric Guitar', ARRAY['Piano', 'Drums', 'Bass Guitar']),
('music', 'easy', 'Who sang "I Will Always Love You" in The Bodyguard?', 'Whitney Houston', ARRAY['Mariah Carey', 'Celine Dion', 'Aretha Franklin']),
('music', 'easy', 'Which artist released the album "Purple Rain"?', 'Prince', ARRAY['Michael Jackson', 'David Bowie', 'George Michael']),
('music', 'easy', 'What band was Freddie Mercury the lead singer of?', 'Queen', ARRAY['The Rolling Stones', 'AC/DC', 'Aerosmith']),
('music', 'easy', 'Who wrote "Imagine"?', 'John Lennon', ARRAY['Paul McCartney', 'George Harrison', 'Bob Dylan']),
('music', 'easy', 'Which artist is known for the song "Thriller"?', 'Michael Jackson', ARRAY['Prince', 'Madonna', 'Whitney Houston']),
('music', 'easy', 'What instrument is Ringo Starr known for playing?', 'Drums', ARRAY['Guitar', 'Bass', 'Keyboards']),
('music', 'easy', 'Who sang "Like a Virgin"?', 'Madonna', ARRAY['Cyndi Lauper', 'Whitney Houston', 'Janet Jackson']),

-- Medium Questions
('music', 'medium', 'What year was Michael Jackson''s "Thriller" released?', '1982', ARRAY['1980', '1984', '1979']),
('music', 'medium', 'What was Elvis Presley''s first number-one hit?', 'Heartbreak Hotel', ARRAY['Hound Dog', 'Jailhouse Rock', 'Love Me Tender']),
('music', 'medium', 'What year did The Beatles break up?', '1970', ARRAY['1968', '1972', '1969']),
('music', 'medium', 'What is the best-selling album of all time?', 'Thriller', ARRAY['Back in Black', 'The Dark Side of the Moon', 'Bat Out of Hell']),
('music', 'medium', 'Which band released "Stairway to Heaven"?', 'Led Zeppelin', ARRAY['Pink Floyd', 'The Who', 'Deep Purple']),
('music', 'medium', 'Who was the lead singer of Nirvana?', 'Kurt Cobain', ARRAY['Eddie Vedder', 'Chris Cornell', 'Layne Staley']),
('music', 'medium', 'What year did Elvis Presley die?', '1977', ARRAY['1975', '1979', '1980']),
('music', 'medium', 'Which artist recorded "Hotel California"?', 'Eagles', ARRAY['Fleetwood Mac', 'The Doobie Brothers', 'Steely Dan']),
('music', 'medium', 'What was the name of The Beatles'' first album?', 'Please Please Me', ARRAY['With The Beatles', 'A Hard Day''s Night', 'Help!']),
('music', 'medium', 'Who wrote "Respect" originally performed by Aretha Franklin?', 'Otis Redding', ARRAY['Aretha Franklin', 'James Brown', 'Sam Cooke']),
('music', 'medium', 'What band did Phil Collins drum for before going solo?', 'Genesis', ARRAY['Yes', 'Pink Floyd', 'The Police']),
('music', 'medium', 'Which artist released "Born to Run" in 1975?', 'Bruce Springsteen', ARRAY['Bob Seger', 'Tom Petty', 'John Mellencamp']),
('music', 'medium', 'What year was MTV launched?', '1981', ARRAY['1979', '1983', '1985']),
('music', 'medium', 'Who sang the original version of "Nothing Compares 2 U"?', 'The Family', ARRAY['Sinead O''Connor', 'Prince', 'Chris Isaak']),
('music', 'medium', 'What was Jimi Hendrix''s only US Top 40 hit?', 'All Along the Watchtower', ARRAY['Purple Haze', 'Hey Joe', 'Foxy Lady']),

-- Hard Questions
('music', 'hard', 'What was the original name of The Black Eyed Peas?', 'Atban Klann', ARRAY['Black Eyed Pods', 'The Peas', 'Urban Tribe']),
('music', 'hard', 'Which classical composer became deaf later in life?', 'Ludwig van Beethoven', ARRAY['Wolfgang Amadeus Mozart', 'Johann Sebastian Bach', 'Franz Schubert']),
('music', 'hard', 'What was the first music video played on MTV?', 'Video Killed the Radio Star', ARRAY['You Better Run', 'Thriller', 'Billie Jean']),
('music', 'hard', 'Which guitarist is known for playing a guitar made from a fireplace?', 'Brian May', ARRAY['Eddie Van Halen', 'Jimmy Page', 'Eric Clapton']),
('music', 'hard', 'What is Bono''s real name?', 'Paul David Hewson', ARRAY['David Evans', 'Adam Clayton', 'Larry Mullen']),
('music', 'hard', 'Which band had members nicknamed "Slash" and "Axl"?', 'Guns N'' Roses', ARRAY['Motley Crue', 'Poison', 'Def Leppard']),
('music', 'hard', 'What instrument does Yo-Yo Ma play?', 'Cello', ARRAY['Violin', 'Viola', 'Double Bass']),
('music', 'hard', 'Which rock band was originally called "The Pendletones"?', 'The Beach Boys', ARRAY['The Byrds', 'The Mamas and the Papas', 'The Turtles']),
('music', 'hard', 'What was Prince''s real name?', 'Prince Rogers Nelson', ARRAY['Prince William Nelson', 'Roger Prince Nelson', 'Prince Albert Nelson']),
('music', 'hard', 'Which singer was born Stefani Joanne Angelina Germanotta?', 'Lady Gaga', ARRAY['Katy Perry', 'Kesha', 'Sia']),
('music', 'hard', 'What year was the first Woodstock festival?', '1969', ARRAY['1967', '1970', '1968']),
('music', 'hard', 'Who played drums on most of The Beatles'' "White Album"?', 'Ringo Starr', ARRAY['Paul McCartney', 'John Lennon', 'A session drummer']),
('music', 'hard', 'What band was Dave Grohl in before Foo Fighters?', 'Nirvana', ARRAY['Soundgarden', 'Pearl Jam', 'Alice in Chains']),
('music', 'hard', 'Which Queen song was used in the film "Wayne''s World"?', 'Bohemian Rhapsody', ARRAY['We Will Rock You', 'We Are the Champions', 'Another One Bites the Dust']),
('music', 'hard', 'What was the first rap song to reach #1 on the Billboard Hot 100?', 'Rapture by Blondie', ARRAY['Rapper''s Delight', 'The Message', 'Walk This Way']),
('music', 'hard', 'Which album by Pink Floyd stayed on the Billboard 200 for 937 weeks?', 'The Dark Side of the Moon', ARRAY['The Wall', 'Wish You Were Here', 'Animals']),
('music', 'hard', 'Who was the youngest Beatle?', 'George Harrison', ARRAY['Ringo Starr', 'Paul McCartney', 'John Lennon']),
('music', 'hard', 'What color were Elvis Presley''s iconic blue suede shoes?', 'Blue', ARRAY['White', 'Black', 'He never owned blue suede shoes']),
('music', 'hard', 'Which artist has won the most Grammy Awards?', 'Beyoncé', ARRAY['Georg Solti', 'Quincy Jones', 'Alison Krauss']),
('music', 'hard', 'What is the longest-running song on the Billboard Hot 100?', 'Blinding Lights', ARRAY['Shape of You', 'Uptown Funk', 'Old Town Road']);

