<?php

namespace App\Models;

class Comment extends Record
{
    public function author()
    {
        return $this->belongsTo(User::class, 'author_id');
    }

    public function likes()
    {
        return $this->belongsToMany(User::class, 'comment_likes');
    }
}
