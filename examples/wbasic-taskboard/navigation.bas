PUBLIC CLASS Navigation EXTENDS wydgit.core/block
    META Id = "divdev/task-navigation"
    CONTENT MARKDOWN "Select a page through GoToPage."
    PUBLIC EVENT PageChanged(PageNumber AS Integer)
    PUBLIC SUB GoToPage(PageNumber AS Integer)
        IF PageNumber >= 1 AND PageNumber <= 3 THEN
            RAISE EVENT PageChanged(PageNumber)
        END IF
    END SUB
END CLASS
