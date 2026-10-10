EVENT Submit
    IF Me.SaveEntry() THEN
        CALL Me.Clear()
        FOR EACH sibling IN Me.related("parent").related("children", "blocks")
            IF sibling.id = "guestbook-status" THEN
                sibling.Set("content", {"type":"markdown", "value":"Thank you for signing the guestbook."})
            END IF
        NEXT sibling
    ELSE
        FOR EACH other IN Me.related("parent").related("children", "blocks")
            IF other.id = "guestbook-status" THEN
                other.Set("content", {"type":"markdown", "value":"Your entry could not be saved. Your message is still in the form."})
            END IF
        NEXT other
    END IF
END EVENT
